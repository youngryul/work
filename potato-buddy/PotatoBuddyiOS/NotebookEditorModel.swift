import SwiftUI
import PencilKit
import PDFKit

/// 노트 편집 상태와 저장·동기화
/// - 필기는 바뀔 때마다 로컬에 바로 쓰고, 멈춘 뒤 잠시 기다렸다가 서버에 올린다.
/// - 서버 저장은 순서대로 한 번에 하나씩 실행한다 (먼저 시작한 업로드가 끊기지 않도록).
@MainActor
final class NotebookEditorModel: ObservableObject {
    enum SaveState: Equatable {
        case saved
        case pending
        case saving
        case failed(String)
    }

    @Published private(set) var notebook: Notebook
    @Published private(set) var pages: [NotebookPage] = []
    @Published private(set) var currentIndex = 0
    @Published private(set) var drawing = PKDrawing()
    @Published private(set) var photos: [NotebookPageImage] = []
    @Published private(set) var background: UIImage?
    @Published private(set) var pageSize = NotebookPageLayout.defaultSize
    /// 캔버스가 drawing을 다시 읽어야 할 때 올린다
    @Published private(set) var revision = 0
    /// 사진 경로 → 이미지
    @Published private(set) var photoImages: [String: UIImage] = [:]
    @Published private(set) var isLoading = true
    @Published private(set) var saveState: SaveState = .saved
    @Published var errorMessage: String?

    /// 마지막 획 이후 서버 저장까지 대기 시간
    private static let saveDelayNanoseconds: UInt64 = 1_500_000_000
    /// 붙이는 사진의 긴 변 최대 픽셀
    private static let photoMaxPixel: CGFloat = 1600
    /// 붙일 때 사진 기본 폭 (pt)
    private static let photoDefaultWidth: CGFloat = 320

    private let initialPageId: String?
    private var pdfDocument: PDFDocument?
    private var backgroundCache: [String: UIImage] = [:]
    private var hasUnsavedChanges = false
    private var debounceTask: Task<Void, Never>?
    private var saveChain: Task<Void, Never>?

    init(notebook: Notebook, initialPageId: String? = nil) {
        self.notebook = notebook
        self.initialPageId = initialPageId
    }

    var currentPage: NotebookPage? {
        pages.indices.contains(currentIndex) ? pages[currentIndex] : nil
    }

    var pageLabel: String {
        pages.isEmpty ? "" : "\(currentIndex + 1) / \(pages.count)"
    }

    // MARK: 불러오기

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            if let pdfPath = notebook.pdfPath {
                let data = try await NotebookFileCache.data(path: pdfPath, version: "pdf")
                pdfDocument = PDFDocument(data: data)
            }
            var loaded = try await SupabaseService.shared.fetchNotebookPages(notebookId: notebook.id)
            if loaded.isEmpty {
                // 페이지가 없는 노트는 빈 페이지 하나로 시작
                loaded = try await SupabaseService.shared.createNotebookPages(
                    notebookId: notebook.id,
                    pages: [NotebookNewPage(pageOrder: 1, paperType: notebook.defaultPaper)]
                )
            }
            pages = loaded
            let startIndex = initialPageId.flatMap { id in loaded.firstIndex { $0.id == id } } ?? 0
            await showPage(at: startIndex, saveCurrent: false)
        } catch {
            errorMessage = "노트를 불러오지 못했어요: \(error.localizedDescription)"
        }
    }

    /// 페이지 이동 (현재 페이지 변경분을 먼저 저장 대기열에 넣는다)
    func showPage(at index: Int, saveCurrent: Bool = true) async {
        guard pages.indices.contains(index) else { return }
        if saveCurrent { flush() }

        currentIndex = index
        let page = pages[index]
        let pdfPage = page.paper == .pdf ? page.pdfPageIndex.flatMap { pdfDocument?.page(at: $0) } : nil
        pageSize = NotebookPageLayout.size(for: pdfPage)
        background = backgroundImage(for: page)
        photos = page.images
        drawing = await loadDrawing(for: page)
        revision += 1
        loadPhotoImages(page.images)

        // 업로드되지 않은 로컬 변경이 남아 있으면 다시 올린다
        if NotebookFileCache.isDirty(pageId: page.id) {
            markChanged()
        }
    }

    private func backgroundImage(for page: NotebookPage) -> UIImage {
        let key = "\(page.id)-\(page.paperType)"
        if let cached = backgroundCache[key] { return cached }
        let pdfPage = page.paper == .pdf ? page.pdfPageIndex.flatMap { pdfDocument?.page(at: $0) } : nil
        let image = NotebookRenderer.backgroundImage(
            paper: page.paper,
            size: NotebookPageLayout.size(for: pdfPage),
            pdfPage: pdfPage
        )
        backgroundCache[key] = image
        return image
    }

    /// 로컬 사본이 최신(또는 업로드 대기 중)이면 로컬, 아니면 서버에서 받는다
    private func loadDrawing(for page: NotebookPage) async -> PKDrawing {
        let local = NotebookFileCache.loadDrawing(pageId: page.id)
        let localIsCurrent = NotebookFileCache.isDirty(pageId: page.id)
            || NotebookFileCache.syncedUpdatedAt(pageId: page.id) == page.updatedAt
            || page.drawingPath == nil
        if let local, localIsCurrent, let drawing = try? PKDrawing(data: local) {
            return drawing
        }
        guard let path = page.drawingPath else { return PKDrawing() }
        do {
            let data = try await SupabaseService.shared.downloadNotebookFile(path: path)
            NotebookFileCache.saveDrawing(data, pageId: page.id)
            NotebookFileCache.markSynced(pageId: page.id, updatedAt: page.updatedAt)
            return try PKDrawing(data: data)
        } catch {
            errorMessage = "필기를 불러오지 못했어요: \(error.localizedDescription)"
            if let local, let drawing = try? PKDrawing(data: local) { return drawing }
            return PKDrawing()
        }
    }

    private func loadPhotoImages(_ photos: [NotebookPageImage]) {
        for photo in photos where photoImages[photo.path] == nil {
            Task {
                guard let data = try? await NotebookFileCache.data(path: photo.path, version: "img"),
                      let image = UIImage(data: data) else { return }
                photoImages[photo.path] = image
            }
        }
    }

    // MARK: 편집

    func drawingChanged(_ newDrawing: PKDrawing) {
        drawing = newDrawing
        markChanged()
    }

    func photosChanged(_ newPhotos: [NotebookPageImage]) {
        photos = newPhotos
        markChanged()
    }

    func deletePhoto(_ photo: NotebookPageImage) {
        photos.removeAll { $0.id == photo.id }
        markChanged()
        Task { try? await SupabaseService.shared.deleteNotebookFiles([photo.path]) }
    }

    func addPhoto(data: Data) async {
        guard let page = currentPage,
              let original = UIImage(data: data),
              let jpeg = Self.downscaled(original).jpegData(compressionQuality: 0.85),
              let image = UIImage(data: jpeg) else {
            errorMessage = "사진을 읽지 못했어요."
            return
        }
        do {
            let photoId = UUID().uuidString.lowercased()
            let path = await SupabaseService.shared.notebookStoragePath(
                notebookId: notebook.id,
                fileName: "photo-\(photoId).jpg"
            )
            try await SupabaseService.shared.uploadNotebookFile(jpeg, path: path, contentType: "image/jpeg")
            NotebookFileCache.storeFile(jpeg, path: path, version: "img")
            photoImages[path] = image

            // 사용자가 그동안 다른 페이지로 넘어갔으면 붙이지 않는다
            guard currentPage?.id == page.id else { return }
            let width = min(Self.photoDefaultWidth, pageSize.width * 0.8)
            let height = width * image.size.height / max(image.size.width, 1)
            let frame = CGRect(
                x: (pageSize.width - width) / 2,
                y: max(24, (pageSize.height - height) / 3),
                width: width,
                height: height
            )
            photos.append(NotebookPageImage(
                id: photoId,
                path: path,
                x: frame.minX,
                y: frame.minY,
                width: frame.width,
                height: frame.height
            ))
            markChanged()
        } catch {
            errorMessage = "사진을 올리지 못했어요: \(error.localizedDescription)"
        }
    }

    private static func downscaled(_ image: UIImage) -> UIImage {
        let longSide = max(image.size.width * image.scale, image.size.height * image.scale)
        guard longSide > photoMaxPixel else { return image }
        let ratio = photoMaxPixel / longSide
        let size = CGSize(width: image.size.width * image.scale * ratio, height: image.size.height * image.scale * ratio)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    /// 현재 페이지 속지 변경 (PDF 페이지는 바꾸지 않음)
    func changePaper(_ paper: NotebookPaperType) {
        guard pages.indices.contains(currentIndex), pages[currentIndex].paper != .pdf else { return }
        pages[currentIndex].paperType = paper.rawValue
        background = backgroundImage(for: pages[currentIndex])
        markChanged()
    }

    /// 현재 페이지 뒤에 빈 페이지 추가
    func addPageAfterCurrent() async {
        flush()
        let currentOrder = currentPage?.pageOrder ?? 0
        let nextOrder = pages.indices.contains(currentIndex + 1) ? pages[currentIndex + 1].pageOrder : currentOrder + 2
        do {
            let created = try await SupabaseService.shared.createNotebookPages(
                notebookId: notebook.id,
                pages: [NotebookNewPage(pageOrder: (currentOrder + nextOrder) / 2, paperType: notebook.defaultPaper)]
            )
            guard let page = created.first else { return }
            let insertIndex = min(currentIndex + 1, pages.count)
            pages.insert(page, at: insertIndex)
            await showPage(at: insertIndex, saveCurrent: false)
        } catch {
            errorMessage = "페이지를 추가하지 못했어요: \(error.localizedDescription)"
        }
    }

    func deleteCurrentPage() async {
        guard let page = currentPage else { return }
        guard pages.count > 1 else {
            errorMessage = "마지막 페이지는 지울 수 없어요."
            return
        }
        debounceTask?.cancel()
        hasUnsavedChanges = false
        // 진행 중인 저장이 끝난 뒤 지워야 파일이 다시 생기지 않는다
        await saveChain?.value
        do {
            try await SupabaseService.shared.deleteNotebookPage(page)
            NotebookFileCache.removePage(pageId: page.id)
            pages.remove(at: currentIndex)
            await showPage(at: min(currentIndex, pages.count - 1), saveCurrent: false)
        } catch {
            errorMessage = "페이지를 지우지 못했어요: \(error.localizedDescription)"
        }
    }

    func updateNotebook(title: String, cover: NotebookCoverColor, paper: NotebookPaperType) async {
        do {
            notebook = try await SupabaseService.shared.updateNotebook(
                id: notebook.id,
                title: title,
                coverColor: cover,
                paperType: paper
            )
        } catch {
            errorMessage = "노트 정보를 저장하지 못했어요: \(error.localizedDescription)"
        }
    }

    // MARK: 저장

    private func markChanged() {
        hasUnsavedChanges = true
        saveState = .pending
        if let page = currentPage {
            NotebookFileCache.saveDrawing(drawing.dataRepresentation(), pageId: page.id)
            NotebookFileCache.markDirty(pageId: page.id)
        }
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.saveDelayNanoseconds)
            guard !Task.isCancelled else { return }
            self?.flush()
        }
    }

    /// 대기 중인 변경을 즉시 저장 대기열에 넣는다
    func flush() {
        debounceTask?.cancel()
        guard hasUnsavedChanges, let page = currentPage, let background else { return }
        hasUnsavedChanges = false

        let snapshot = PageSnapshot(
            page: page,
            content: currentRenderContent(background: background),
            photos: photos
        )
        let previous = saveChain
        saveChain = Task { [weak self] in
            await previous?.value
            await self?.save(snapshot)
        }
    }

    /// 화면을 닫기 전 모든 저장이 끝날 때까지 기다린다
    func flushAndWait() async {
        flush()
        await saveChain?.value
    }

    /// 화면에 있는 페이지의 렌더링 재료
    private func currentRenderContent(background: UIImage) -> NotebookRenderContent {
        var renderedPhotos: [(image: UIImage, frame: CGRect)] = []
        for photo in photos {
            if let image = photoImages[photo.path] {
                renderedPhotos.append((image: image, frame: photo.frame))
            }
        }
        return NotebookRenderContent(size: pageSize, background: background, photos: renderedPhotos, drawing: drawing)
    }

    private struct PageSnapshot {
        let page: NotebookPage
        let content: NotebookRenderContent
        let photos: [NotebookPageImage]
    }

    private func save(_ snapshot: PageSnapshot) async {
        saveState = .saving
        let service = SupabaseService.shared
        let page = snapshot.page
        do {
            let drawingData = snapshot.content.drawing.dataRepresentation()
            let drawingPath = await service.notebookStoragePath(notebookId: notebook.id, fileName: "\(page.id).drawing")
            try await service.uploadNotebookFile(drawingData, path: drawingPath, contentType: "application/octet-stream")

            let previewPath = await service.notebookStoragePath(notebookId: notebook.id, fileName: "\(page.id)-preview.jpg")
            let preview = NotebookRenderer.previewJPEG(snapshot.content)
            if let preview {
                try await service.uploadNotebookFile(preview, path: previewPath, contentType: "image/jpeg")
            }

            let recognized = await HandwritingRecognizer.recognize(snapshot.content.drawing)
            let photosJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(snapshot.photos))
            let updated = try await service.updateNotebookPage(id: page.id, fields: [
                "drawing_path": drawingPath,
                "preview_path": preview != nil ? previewPath as Any : NSNull(),
                "images": photosJSON,
                "paper_type": page.paperType,
                "recognized_text": recognized,
            ])

            // 저장하는 동안 새로 그린 내용이 없을 때만 동기화 완료로 표시
            if !(hasUnsavedChanges && currentPage?.id == page.id) {
                NotebookFileCache.markSynced(pageId: page.id, updatedAt: updated.updatedAt)
            }
            if let preview {
                NotebookFileCache.storeFile(preview, path: previewPath, version: updated.updatedAt ?? "")
            }
            if let index = pages.firstIndex(where: { $0.id == page.id }) {
                var merged = updated
                // 화면에 있는 페이지는 저장 중 바뀐 사진·속지를 유지한다
                if index == currentIndex {
                    merged.images = photos
                    merged.paperType = pages[index].paperType
                }
                pages[index] = merged
            }
            saveState = hasUnsavedChanges ? .pending : .saved
        } catch {
            NotebookFileCache.markDirty(pageId: page.id)
            saveState = .failed(error.localizedDescription)
        }
    }

    // MARK: 내보내기

    /// 전체 노트를 PDF 파일로 (임시 폴더)
    func exportPDF() async throws -> URL {
        await flushAndWait()
        var contents: [NotebookRenderContent] = []
        for (index, page) in pages.enumerated() {
            if index == currentIndex, let background {
                contents.append(currentRenderContent(background: background))
                continue
            }
            let pdfPage = page.paper == .pdf ? page.pdfPageIndex.flatMap { pdfDocument?.page(at: $0) } : nil
            var pagePhotos: [(image: UIImage, frame: CGRect)] = []
            for photo in page.images {
                if let data = try? await NotebookFileCache.data(path: photo.path, version: "img"),
                   let image = UIImage(data: data) {
                    pagePhotos.append((image: image, frame: photo.frame))
                }
            }
            contents.append(NotebookRenderContent(
                size: NotebookPageLayout.size(for: pdfPage),
                background: backgroundImage(for: page),
                photos: pagePhotos,
                drawing: await loadDrawing(for: page)
            ))
        }
        let data = NotebookRenderer.pdfData(contents)
        return try writeTemporary(data, ext: "pdf")
    }

    /// 현재 페이지를 PNG 파일로 (임시 폴더)
    func exportCurrentPageImage() throws -> URL {
        guard let background else { throw URLError(.cannotCreateFile) }
        let image = NotebookRenderer.composite(currentRenderContent(background: background), scale: 2)
        guard let data = image.pngData() else { throw URLError(.cannotCreateFile) }
        return try writeTemporary(data, ext: "png", suffix: "-\(currentIndex + 1)")
    }

    private func writeTemporary(_ data: Data, ext: String, suffix: String = "") throws -> URL {
        let name = notebook.displayTitle
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "_")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name)\(suffix).\(ext)")
        try data.write(to: url, options: .atomic)
        return url
    }
}
