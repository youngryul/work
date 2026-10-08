import SwiftUI
import PhotosUI
import UIKit

private enum DiaryWriteMode: CaseIterable {
    case aiFourCut, photos

    var label: String {
        switch self {
        case .aiFourCut: return "AI 4컷"
        case .photos: return "사진 첨부"
        }
    }

    var note: String {
        switch self {
        case .aiFourCut: return "일기를 네 장면으로 나눠 시간 흐름이 보이게 그립니다."
        case .photos: return "사진을 넣으면 바로 저장돼요. 사진을 누르면 달력 대표 사진이 됩니다."
        }
    }
}

struct DiaryWriteView: View {
    let date: String
    let existingDiary: DiaryItem?
    var onCancel: () -> Void
    var onSaved: (DiaryItem) -> Void
    /// 사진 자동 저장 시 호출 (작성 화면은 유지)
    var onAutoSaved: (DiaryItem) -> Void

    /// 첨부 사진 최대 장수 (웹과 동일)
    private static let photoAttachMax = 10

    @State private var content: String
    @State private var mode: DiaryWriteMode
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var attachedUrls: [String]
    /// 사진 자동 저장·대표 사진 변경 후 최신 일기
    @State private var latestDiary: DiaryItem?
    @State private var isSavingPhotos = false
    @State private var isSaving = false
    @State private var isGeneratingText = ""
    @State private var progressDone = 0
    @State private var progressTotal = 4
    @State private var errorMessage = ""

    init(
        date: String, existingDiary: DiaryItem?,
        onCancel: @escaping () -> Void,
        onSaved: @escaping (DiaryItem) -> Void,
        onAutoSaved: @escaping (DiaryItem) -> Void = { _ in }
    ) {
        self.date = date
        self.existingDiary = existingDiary
        self.onCancel = onCancel
        self.onSaved = onSaved
        self.onAutoSaved = onAutoSaved
        _content = State(initialValue: existingDiary?.content ?? "")
        _attachedUrls = State(initialValue: existingDiary?.attachedImages ?? [])
        if let existing = existingDiary, !existing.hasAiFourCut, existing.hasPhotos {
            _mode = State(initialValue: .photos)
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
        case .aiFourCut: return "4컷 저장 (\(SupabaseService.fourCutTokenCost)토큰)"
        case .photos: return "완료"
        }
    }

    private var hasContent: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSave: Bool {
        hasContent && !isSavingPhotos
    }

    /// 자동 저장 결과가 있으면 그것을, 없으면 처음 받은 일기를 기준으로 쓴다
    private var currentDiary: DiaryItem? {
        latestDiary ?? existingDiary
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
                        .scrollContentBackground(.hidden)
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
    }

    private var drawingBox: some View {
        VStack {
            switch mode {
            case .aiFourCut:
                fourCutPreviewGrid(urls: currentDiary?.hasAiFourCut == true ? currentDiary?.fourCutSceneUrls ?? [] : [])
            case .photos:
                photoAttachGrid
            }
        }
        .padding(9)
        .background(Color.white)
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(SketchbookStyle.ink, lineWidth: 3))
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

    private var photoAttachGrid: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3), spacing: 7) {
                ForEach(Array(attachedUrls.enumerated()), id: \.element) { index, urlString in
                    attachedPhotoCell(index: index, urlString: urlString)
                }
                if attachedUrls.count < Self.photoAttachMax {
                    PhotosPicker(
                        selection: $photoItems,
                        maxSelectionCount: Self.photoAttachMax - attachedUrls.count,
                        matching: .images
                    ) {
                        ZStack {
                            Color(white: 0.95)
                            Text("+ 사진 넣기").font(.system(size: 10, design: .monospaced)).foregroundStyle(.black.opacity(0.42))
                        }
                        .aspectRatio(1, contentMode: .fit)
                    }
                    .disabled(isSavingPhotos)
                }
            }

            HStack(spacing: 6) {
                if isSavingPhotos {
                    ProgressView().controlSize(.small)
                    Text("사진 저장 중…")
                } else {
                    Text("사진을 누르면 대표 사진이 돼요 · \(attachedUrls.count)/\(Self.photoAttachMax)장")
                }
            }
            .font(.system(size: 12))
            .foregroundStyle(SketchbookStyle.muted)
        }
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await addPhotos(items) }
        }
    }

    private func attachedPhotoCell(index: Int, urlString: String) -> some View {
        let isCover = currentDiary?.thumbnailUrl == urlString
        return ZStack(alignment: .topTrailing) {
            Button {
                Task { await selectCover(urlString) }
            } label: {
                ZStack(alignment: .bottomLeading) {
                    Color(white: 0.95)
                    AsyncImage(url: URL(string: urlString)) { phase in
                        if case .success(let image) = phase {
                            image.resizable().aspectRatio(contentMode: .fill)
                        }
                    }
                    if isCover {
                        Text("대표")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(SketchbookStyle.greenDark)
                            .padding(4)
                    }
                }
                .aspectRatio(1, contentMode: .fit)
                .clipped()
                .overlay(
                    Rectangle().stroke(isCover ? SketchbookStyle.greenDark : Color.clear, lineWidth: 3)
                )
            }
            .buttonStyle(.plain)
            .disabled(isSavingPhotos)

            Button {
                Task { await removePhoto(at: index) }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.white, .red)
                    .padding(4)
            }
            .buttonStyle(.plain)
            .disabled(isSavingPhotos)
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
        if mode == .photos {
            // 사진은 이미 자동 저장됨: 글만 한 번 더 저장하고 닫는다
            await saveTextOnly()
            return
        }
        isSaving = true
        errorMessage = ""
        progressDone = 0
        do {
            switch mode {
            case .aiFourCut:
                isGeneratingText = "장면을 하나씩 그리고 있어요…"
                let result = try await SupabaseService.shared.generateFourCutDiary(
                    date: date, content: content, existingCoverImageUrl: currentDiary?.coverImageUrl,
                    onProgress: { done, total in
                        Task { @MainActor in
                            progressDone = done
                            progressTotal = total
                        }
                    }
                )
                onSaved(result.item)
            case .photos:
                break
            }
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isSaving = false
    }

    // MARK: - 사진 자동 저장

    /// 고른 사진을 업로드하고 바로 첨부 목록에 저장한다
    private func addPhotos(_ items: [PhotosPickerItem]) async {
        photoItems = []
        guard hasContent else {
            errorMessage = "먼저 일기 글을 작성해 주세요."
            return
        }
        let room = Self.photoAttachMax - attachedUrls.count
        guard room > 0 else { return }

        isSavingPhotos = true
        errorMessage = ""
        defer { isSavingPhotos = false }
        do {
            var datas: [Data] = []
            for item in items.prefix(room) {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                // HEIC·PNG 등도 JPEG로 맞춰 업로드 (Storage contentType과 일치)
                datas.append(UIImage(data: data)?.jpegData(compressionQuality: 0.85) ?? data)
            }
            guard !datas.isEmpty else { return }
            let urls = try await SupabaseService.shared.uploadDiaryPhotos(date: date, photos: datas)
            try await persistPhotos(attachedUrls + urls)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func removePhoto(at index: Int) async {
        guard attachedUrls.indices.contains(index) else { return }
        isSavingPhotos = true
        errorMessage = ""
        defer { isSavingPhotos = false }
        var next = attachedUrls
        next.remove(at: index)
        do {
            try await persistPhotos(next)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func persistPhotos(_ next: [String]) async throws {
        let saved = try await SupabaseService.shared.saveDiaryAttachedImages(
            date: date, content: content, attachedImages: next, existing: currentDiary
        )
        latestDiary = saved
        attachedUrls = saved.attachedImages
        onAutoSaved(saved)
    }

    private func selectCover(_ url: String) async {
        guard currentDiary != nil, currentDiary?.thumbnailUrl != url else { return }
        isSavingPhotos = true
        errorMessage = ""
        defer { isSavingPhotos = false }
        do {
            let updated = try await SupabaseService.shared.updateDiaryCoverImage(date: date, coverImageUrl: url)
            latestDiary = updated
            onAutoSaved(updated)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
