import SwiftUI
import PencilKit
import Vision

/// 할일 입력 방식 (키보드 / 손글씨)
enum TaskInputMode: String, CaseIterable, Identifiable {
    case keyboard
    case handwriting

    var id: String { rawValue }

    var label: String {
        switch self {
        case .keyboard: return "키보드"
        case .handwriting: return "손글씨"
        }
    }
}

/// 할일 제목 입력 섹션 (키보드 / 손글씨 전환)
/// - 손글씨 모드에서는 인식된 글자가 제목 칸에 자동으로 채워지고, 직접 고칠 수 있다.
struct TaskTitleInputSection: View {
    @Binding var mode: TaskInputMode
    @Binding var title: String
    @Binding var drawing: PKDrawing

    var body: some View {
        Section {
            Picker("입력 방식", selection: $mode) {
                ForEach(TaskInputMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            if mode == .handwriting {
                HandwritingPad(drawing: $drawing) { recognized in
                    title = recognized
                }
                TextField("인식된 글자 (검색·알림·위젯에 사용)", text: $title)
            } else {
                TextField("할일 제목", text: $title)
            }
        } header: {
            Text("할일")
        } footer: {
            if mode == .handwriting {
                Text("목록에는 손글씨 그대로 보여요. 인식이 틀리면 직접 고쳐주세요.")
            }
        }
    }

    /// 저장 가능한 입력인지
    static func canSubmit(mode: TaskInputMode, title: String, drawing: PKDrawing) -> Bool {
        switch mode {
        case .keyboard:
            return !title.trimmingCharacters(in: .whitespaces).isEmpty
        case .handwriting:
            return !drawing.strokes.isEmpty
        }
    }

    /// 손글씨 모드면 이미지를 업로드하고 (제목, 이미지 URL)을 반환한다.
    /// 인식 결과가 비어 있으면 기본 제목을 사용한다.
    static func prepareSubmission(
        mode: TaskInputMode,
        title: String,
        drawing: PKDrawing
    ) async throws -> (title: String, handwritingImageUrl: String?) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard mode == .handwriting else { return (trimmed, nil) }

        guard let png = HandwritingRecognizer.pngData(from: drawing) else {
            throw NSError(domain: "Handwriting", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "손글씨를 먼저 써주세요."])
        }
        let url = try await SupabaseService.shared.uploadTaskHandwriting(png)
        return (trimmed.isEmpty ? "손글씨 메모" : trimmed, url)
    }
}

/// Apple Pencil(또는 손가락)로 쓰는 손글씨 입력 칸
/// - 쓰기를 멈추면 글자 인식 결과를 onRecognized로 전달한다.
struct HandwritingPad: View {
    @Binding var drawing: PKDrawing
    var onRecognized: (String) -> Void

    /// 마지막 획 이후 인식을 시작하기까지 대기 시간
    private static let recognizeDelayNanoseconds: UInt64 = 700_000_000

    @State private var recognizeTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            HandwritingCanvas(drawing: $drawing)
                .frame(height: 140)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.white)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.gray.opacity(0.35), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))

            Button("지우기") {
                drawing = PKDrawing()
            }
            .font(.footnote)
            // Form 행 전체가 버튼으로 눌리지 않도록 (캔버스에 쓸 때 지워지는 문제 방지)
            .buttonStyle(.borderless)
            .disabled(drawing.strokes.isEmpty)
        }
        .onChange(of: drawing) { _, newDrawing in
            scheduleRecognition(for: newDrawing)
        }
        .onDisappear {
            recognizeTask?.cancel()
        }
    }

    private func scheduleRecognition(for drawing: PKDrawing) {
        recognizeTask?.cancel()
        guard !drawing.strokes.isEmpty else {
            onRecognized("")
            return
        }
        recognizeTask = Task {
            try? await Task.sleep(nanoseconds: Self.recognizeDelayNanoseconds)
            if Task.isCancelled { return }
            let text = await HandwritingRecognizer.recognize(drawing)
            if Task.isCancelled { return }
            await MainActor.run { onRecognized(text) }
        }
    }
}

/// PKCanvasView 래퍼
private struct HandwritingCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.delegate = context.coordinator
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: .black, width: 4)
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // 다크 모드에서도 잉크가 검정으로 보이도록 고정
        canvas.overrideUserInterfaceStyle = .light
        canvas.isScrollEnabled = false
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        if canvas.drawing != drawing {
            canvas.drawing = drawing
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(drawing: $drawing)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var drawing: Binding<PKDrawing>

        init(drawing: Binding<PKDrawing>) {
            self.drawing = drawing
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawing.wrappedValue = canvasView.drawing
        }
    }
}

/// 손글씨 이미지 생성 및 글자 인식
enum HandwritingRecognizer {
    /// 글씨 주변 여백
    private static let padding: CGFloat = 12

    /// 저장용 이미지: 글씨 영역만 잘라낸 투명 배경 PNG
    static func pngData(from drawing: PKDrawing) -> Data? {
        guard !drawing.strokes.isEmpty else { return nil }
        let image = render(drawing, scale: 2)
        return image.pngData()
    }

    /// 손글씨를 글자로 인식한다. 실패하면 빈 문자열을 반환한다.
    static func recognize(_ drawing: PKDrawing) async -> String {
        guard !drawing.strokes.isEmpty else { return "" }

        // 인식률을 위해 흰 배경 위에 그린 이미지를 사용
        let inkImage = render(drawing, scale: 2)
        let format = UIGraphicsImageRendererFormat()
        format.scale = inkImage.scale
        let flattened = UIGraphicsImageRenderer(size: inkImage.size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: inkImage.size))
            inkImage.draw(at: .zero)
        }
        guard let cgImage = flattened.cgImage else { return "" }

        return await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["ko-KR", "en-US"]
            request.usesLanguageCorrection = true

            do {
                try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
            } catch {
                return ""
            }

            let observations = request.results ?? []
            // 위에서 아래, 왼쪽에서 오른쪽 순서로 이어 붙인다
            let sorted = observations.sorted {
                abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.1
                    ? $0.boundingBox.midY > $1.boundingBox.midY
                    : $0.boundingBox.minX < $1.boundingBox.minX
            }
            return sorted
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }.value
    }

    /// 다크 모드와 관계없이 검정 잉크로 렌더링
    private static func render(_ drawing: PKDrawing, scale: CGFloat) -> UIImage {
        let rect = drawing.bounds.insetBy(dx: -padding, dy: -padding)
        var image = UIImage()
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            image = drawing.image(from: rect, scale: scale)
        }
        return image
    }
}

/// 할일 카드에 표시할 손글씨 이미지 (불러오지 못하면 제목 글자로 대체)
struct HandwritingTitleImage: View {
    let url: URL
    let fallbackTitle: String
    let isStruckThrough: Bool

    /// 카드 안 손글씨 최대 높이
    private static let maxHeight: CGFloat = 72

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: Self.maxHeight, alignment: .leading)
                    .overlay {
                        if isStruckThrough {
                            Rectangle()
                                .fill(Color(red: 0.35, green: 0.32, blue: 0.28))
                                .frame(height: 2)
                        }
                    }
                    .accessibilityLabel(fallbackTitle)
            case .empty:
                ProgressView()
                    .frame(height: 32)
            default:
                Text(fallbackTitle)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .strikethrough(isStruckThrough)
            }
        }
    }
}
