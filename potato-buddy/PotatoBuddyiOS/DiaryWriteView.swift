import SwiftUI
import PhotosUI
import UIKit

private enum DiaryWriteMode: CaseIterable {
    case oneCut, aiFourCut, photoFourCut

    var label: String {
        switch self {
        case .oneCut: return "AI 1컷"
        case .aiFourCut: return "AI 4컷"
        case .photoFourCut: return "사진 4컷"
        }
    }

    var note: String {
        switch self {
        case .oneCut: return "일기를 읽고 그림 한 장을 그려 줍니다."
        case .aiFourCut: return "일기를 네 장면으로 나눠 시간 흐름이 보이게 그립니다."
        case .photoFourCut: return "사진 네 장을 붙여 4컷으로 만듭니다. 토큰이 들지 않아요."
        }
    }
}

struct DiaryWriteView: View {
    let date: String
    let existingDiary: DiaryItem?
    var onCancel: () -> Void
    var onSaved: (DiaryItem) -> Void

    @State private var content: String
    @State private var mode: DiaryWriteMode
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var photoDatas: [Data] = []
    @State private var isSaving = false
    @State private var isGeneratingText = ""
    @State private var progressDone = 0
    @State private var progressTotal = 4
    @State private var errorMessage = ""
    @State private var tokenInfo: SupabaseService.AiTokenInfo?

    init(date: String, existingDiary: DiaryItem?, onCancel: @escaping () -> Void, onSaved: @escaping (DiaryItem) -> Void) {
        self.date = date
        self.existingDiary = existingDiary
        self.onCancel = onCancel
        self.onSaved = onSaved
        _content = State(initialValue: existingDiary?.content ?? "")
        if let existing = existingDiary {
            if existing.isPhotoFourCut { _mode = State(initialValue: .photoFourCut) }
            else if existing.hasFourCut { _mode = State(initialValue: .aiFourCut) }
            else { _mode = State(initialValue: .oneCut) }
        } else {
            _mode = State(initialValue: .aiFourCut)
        }
    }

    private var formattedDate: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "M월 d일"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: date) else { return date }
        return outFmt.string(from: d)
    }

    private var dayName: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "EEEE"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: date) else { return "" }
        return outFmt.string(from: d)
    }

    private var saveLabel: String {
        switch mode {
        case .oneCut: return "저장 (\(tokenInfo?.generationCost ?? 3)토큰)"
        case .aiFourCut: return "4컷 저장 (\(SupabaseService.fourCutTokenCost)토큰)"
        case .photoFourCut: return "4컷 만들어 저장"
        }
    }

    private var canSave: Bool {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        if mode == .photoFourCut { return !photoDatas.isEmpty }
        return true
    }

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Button("‹ 달력") { onCancel() }
                            .foregroundStyle(SketchbookStyle.ink)
                        Spacer()
                        Button("글만 저장") { Task { await saveTextOnly() } }
                            .foregroundStyle(SketchbookStyle.greenText)
                            .disabled(isSaving || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    .font(.system(size: 15))
                    .padding(.bottom, 10)

                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text(formattedDate).font(.sketchbook(27)).foregroundStyle(SketchbookStyle.ink)
                        Text(dayName).font(.system(size: 15)).foregroundStyle(SketchbookStyle.muted)
                    }
                    SketchUnderline(color: SketchbookStyle.underlinePink, width: 96, rotation: -0.8)
                        .padding(.top, -4)
                        .padding(.bottom, 14)

                    HStack(spacing: 6) {
                        ForEach(DiaryWriteMode.allCases, id: \.self) { m in
                            Button {
                                mode = m
                            } label: {
                                Text(m.label)
                                    .font(.system(size: 14))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .foregroundStyle(mode == m ? SketchbookStyle.ink : SketchbookStyle.muted)
                                    .background(mode == m ? Color.white : Color.white.opacity(0.45))
                                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                                    .clipShape(RoundedRectangle(cornerRadius: 5))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, 14)

                    drawingBox
                        .padding(.bottom, 10)

                    Text(mode.note)
                        .font(.system(size: 13))
                        .foregroundStyle(Color(red: 0.54, green: 0.48, blue: 0.32))
                        .padding(.bottom, 16)

                    HStack {
                        Text("오늘 있었던 일").font(.system(size: 17)).foregroundStyle(SketchbookStyle.ink)
                        Spacer()
                        Text("\(content.count)자").font(.system(size: 12)).foregroundStyle(SketchbookStyle.muted)
                    }
                    .padding(.bottom, 7)

                    TextEditor(text: $content)
                        .font(.sketchbook(16))
                        .foregroundStyle(SketchbookStyle.ink)
                        .frame(height: 150)
                        .padding(10)
                        .background(Color.white)
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                        .padding(.bottom, 14)

                    HStack(spacing: 9) {
                        Text("오늘의 감정").font(.system(size: 14)).foregroundStyle(SketchbookStyle.muted)
                        EmotionStampView(emotion: DiaryEmotionLabels.label(for: existingDiary?.emotion))
                        Text("글을 저장하면 자동으로 찍혀요").font(.system(size: 12)).foregroundStyle(SketchbookStyle.mutedLight)
                    }
                    .padding(.bottom, 20)

                    if !errorMessage.isEmpty {
                        Text(errorMessage).font(.system(size: 13)).foregroundStyle(.red).padding(.bottom, 8)
                    }

                    HStack(spacing: 9) {
                        Button("취소") { onCancel() }
                            .font(.system(size: 17))
                            .foregroundStyle(SketchbookStyle.ink)
                            .padding(.horizontal, 18)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                            .clipShape(RoundedRectangle(cornerRadius: 6))

                        Button {
                            Task { await save() }
                        } label: {
                            Text(saveLabel)
                                .font(.system(size: 18))
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .foregroundStyle(.white)
                                .background(SketchbookStyle.green)
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                        .disabled(!canSave || isSaving)
                        .opacity(canSave ? 1 : 0.5)
                    }
                    .padding(.bottom, 30)
                }
                .padding(.horizontal, 18)
                .padding(.top, 36)
            }

            if isSaving {
                generatingOverlay
            }
        }
        .task { tokenInfo = try? await SupabaseService.shared.getMyAiTokenInfo() }
    }

    private var drawingBox: some View {
        VStack {
            switch mode {
            case .oneCut:
                oneCutPreview
            case .aiFourCut:
                fourCutPreviewGrid(urls: existingDiary?.hasFourCut == true ? existingDiary?.fourCutSceneUrls ?? [] : [])
            case .photoFourCut:
                photoPickerGrid
            }
        }
        .padding(9)
        .background(Color.white)
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(SketchbookStyle.ink, lineWidth: 3))
    }

    private var oneCutPreview: some View {
        ZStack {
            Color(white: 0.95)
            if let urlString = existingDiary?.imageUrl, let url = URL(string: urlString), existingDiary?.hasFourCut != true {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    }
                }
                .clipped()
            } else {
                VStack(spacing: 9) {
                    Text("AI 1컷 · 그림 자리").font(.system(size: 11)).foregroundStyle(.black.opacity(0.42))
                    Text("저장하면 그려져요").font(.system(size: 13)).foregroundStyle(SketchbookStyle.ink)
                }
            }
        }
        .aspectRatio(4.0 / 3.0, contentMode: .fit)
        .clipped()
    }

    private func fourCutPreviewGrid(urls: [String]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)], spacing: 7) {
            ForEach(0..<4, id: \.self) { i in
                ZStack {
                    Color(white: 0.95)
                    if i < urls.count, let url = URL(string: urls[i]) {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().aspectRatio(contentMode: .fill)
                            }
                        }
                        .clipped()
                    } else {
                        Text("장면 \(i + 1)").font(.system(size: 10, design: .monospaced)).foregroundStyle(.black.opacity(0.42))
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipped()
            }
        }
    }

    private var photoPickerGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)], spacing: 7) {
            ForEach(0..<4, id: \.self) { i in
                ZStack {
                    Color(white: 0.95)
                    if i < photoDatas.count, let uiImage = UIImage(data: photoDatas[i]) {
                        Image(uiImage: uiImage).resizable().aspectRatio(contentMode: .fill)
                    } else {
                        Text("+ 사진 넣기").font(.system(size: 10, design: .monospaced)).foregroundStyle(.black.opacity(0.42))
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipped()
            }
        }
        .overlay(
            PhotosPicker(selection: $photoItems, maxSelectionCount: 4, matching: .images) {
                Color.clear
            }
            .allowsHitTesting(true)
        )
        .onChange(of: photoItems) { _, items in
            Task {
                var datas: [Data] = []
                for item in items.prefix(4) {
                    if let data = try? await item.loadTransferable(type: Data.self) {
                        datas.append(data)
                    }
                }
                photoDatas = datas
            }
        }
    }

    private var generatingOverlay: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
            VStack(spacing: 12) {
                ProgressView()
                    .tint(.white)
                Text(isGeneratingText.isEmpty ? "저장하고 있어요…" : isGeneratingText)
                    .font(.system(size: 15))
                    .foregroundStyle(.white)
                if mode == .aiFourCut && progressTotal > 0 {
                    Text("\(progressDone)/\(progressTotal) 장면 완성")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }
            .padding(24)
            .background(SketchbookStyle.ink.opacity(0.001)) // 터치 흡수용
        }
    }

    // MARK: - 저장

    private func saveTextOnly() async {
        isSaving = true
        errorMessage = ""
        do {
            let result = try await SupabaseService.shared.saveDiaryTextOnly(date: date, content: content)
            onSaved(result.item)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isSaving = false
    }

    private func save() async {
        isSaving = true
        errorMessage = ""
        progressDone = 0
        do {
            switch mode {
            case .oneCut:
                isGeneratingText = "그림을 그리고 있어요…"
                let isRegenerate = existingDiary?.imageUrl != nil
                let result = try await SupabaseService.shared.generateOneCutImage(
                    date: date, content: content, isRegenerate: isRegenerate,
                    existingCoverImageUrl: existingDiary?.coverImageUrl
                )
                onSaved(result.item)
            case .aiFourCut:
                isGeneratingText = "장면을 하나씩 그리고 있어요…"
                let result = try await SupabaseService.shared.generateFourCutDiary(
                    date: date, content: content, existingCoverImageUrl: existingDiary?.coverImageUrl,
                    onProgress: { done, total in
                        Task { @MainActor in
                            progressDone = done
                            progressTotal = total
                        }
                    }
                )
                onSaved(result.item)
            case .photoFourCut:
                isGeneratingText = "4컷을 만들고 있어요…"
                let result = try await SupabaseService.shared.savePhotoFourCutDiary(
                    date: date, content: content, photos: photoDatas,
                    existingCoverImageUrl: existingDiary?.coverImageUrl
                )
                onSaved(result.item)
            }
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isSaving = false
    }
}
