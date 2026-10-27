import SwiftUI
import PhotosUI

/// 노트 필기 화면 (전체 화면)
struct NotebookEditorView: View {
    @StateObject private var model: NotebookEditorModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    @State private var isPhotoEditing = false
    @State private var showPhotoPicker = false
    @State private var photoItem: PhotosPickerItem?
    @State private var showPageGrid = false
    @State private var showSettings = false
    @State private var showDeletePageConfirm = false
    @State private var photoToDelete: NotebookPageImage?
    @State private var shareItems: [Any]?
    @State private var isExporting = false
    @State private var isClosing = false

    init(notebook: Notebook, initialPageId: String? = nil) {
        _model = StateObject(wrappedValue: NotebookEditorModel(notebook: notebook, initialPageId: initialPageId))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGray5).ignoresSafeArea()
                if let page = model.currentPage {
                    NotebookCanvasView(
                        pageId: page.id,
                        revision: model.revision,
                        pageSize: model.pageSize,
                        background: model.background,
                        drawing: model.drawing,
                        photos: model.photos,
                        photoImages: model.photoImages,
                        isPhotoEditing: isPhotoEditing,
                        onDrawingChanged: { model.drawingChanged($0) },
                        onPhotosChanged: { model.photosChanged($0) },
                        onDeletePhoto: { photoToDelete = $0 }
                    )
                    .ignoresSafeArea(edges: .bottom)
                }
                if model.isLoading || isExporting || isClosing {
                    ProgressView()
                        .padding(20)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if isPhotoEditing {
                    photoEditingBanner
                }
            }
            .navigationTitle(model.notebook.displayTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .task { await model.load() }
        .onChange(of: scenePhase) { _, phase in
            // 앱이 백그라운드로 가면 바로 저장
            if phase != .active { model.flush() }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            photoItem = nil
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await model.addPhoto(data: data)
                    isPhotoEditing = true
                }
            }
        }
        .sheet(isPresented: $showPageGrid) {
            NotebookPageGridView(model: model)
        }
        .sheet(isPresented: $showSettings) {
            NotebookFormView(notebook: model.notebook) { title, cover, paper in
                await model.updateNotebook(title: title, cover: cover, paper: paper)
            }
        }
        .sheet(isPresented: Binding(
            get: { shareItems != nil },
            set: { if !$0 { shareItems = nil } }
        )) {
            if let shareItems {
                ActivityShareSheet(items: shareItems)
            }
        }
        .confirmationDialog("이 페이지를 지울까요?", isPresented: $showDeletePageConfirm, titleVisibility: .visible) {
            Button("페이지 삭제", role: .destructive) {
                Task { await model.deleteCurrentPage() }
            }
            Button("취소", role: .cancel) {}
        }
        .confirmationDialog(
            "사진을 지울까요?",
            isPresented: Binding(get: { photoToDelete != nil }, set: { if !$0 { photoToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("사진 삭제", role: .destructive) {
                if let photoToDelete { model.deletePhoto(photoToDelete) }
                photoToDelete = nil
            }
            Button("취소", role: .cancel) { photoToDelete = nil }
        }
        .alert("알림", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var photoEditingBanner: some View {
        HStack {
            Text("끌어서 이동 · 두 손가락으로 크기 조절 · 길게 눌러 삭제")
                .font(.footnote)
            Spacer()
            Button("완료") { isPhotoEditing = false }
                .font(.footnote.weight(.semibold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.green.opacity(0.15))
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                Task { await close() }
            } label: {
                Image(systemName: "chevron.down")
            }
            .disabled(isClosing)
        }

        ToolbarItemGroup(placement: .topBarTrailing) {
            saveStateIcon

            Button {
                Task { await model.showPage(at: model.currentIndex - 1) }
            } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(model.currentIndex == 0)

            Button {
                showPageGrid = true
            } label: {
                Text(model.pageLabel)
                    .font(.footnote.monospacedDigit())
            }

            Button {
                Task { await model.showPage(at: model.currentIndex + 1) }
            } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(model.currentIndex >= model.pages.count - 1)

            moreMenu
        }
    }

    @ViewBuilder
    private var saveStateIcon: some View {
        switch model.saveState {
        case .saved:
            Image(systemName: "checkmark.icloud")
                .foregroundStyle(.secondary)
                .accessibilityLabel("저장됨")
        case .pending, .saving:
            Image(systemName: "arrow.triangle.2.circlepath.icloud")
                .foregroundStyle(.secondary)
                .accessibilityLabel("저장 중")
        case .failed(let message):
            Button {
                model.errorMessage = "저장하지 못했어요. 기기에는 남아 있고 다음에 다시 올려요.\n\(message)"
            } label: {
                Image(systemName: "exclamationmark.icloud")
                    .foregroundStyle(.orange)
            }
        }
    }

    private var moreMenu: some View {
        Menu {
            Button {
                Task { await model.addPageAfterCurrent() }
            } label: {
                Label("다음에 페이지 추가", systemImage: "doc.badge.plus")
            }

            if model.currentPage?.paper != .pdf {
                Menu {
                    ForEach(NotebookPaperType.selectable) { paper in
                        Button {
                            model.changePaper(paper)
                        } label: {
                            if model.currentPage?.paper == paper {
                                Label(paper.label, systemImage: "checkmark")
                            } else {
                                Text(paper.label)
                            }
                        }
                    }
                } label: {
                    Label("속지 바꾸기", systemImage: "square.grid.3x3")
                }
            }

            Button {
                showPhotoPicker = true
            } label: {
                Label("사진 붙이기", systemImage: "photo.badge.plus")
            }

            if !model.photos.isEmpty {
                Button {
                    isPhotoEditing.toggle()
                } label: {
                    Label(isPhotoEditing ? "사진 편집 끝내기" : "사진 옮기기·크기 조절", systemImage: "hand.draw")
                }
            }

            Divider()

            Button {
                Task { await exportPDF() }
            } label: {
                Label("PDF로 내보내기", systemImage: "doc.richtext")
            }

            Button {
                exportImage()
            } label: {
                Label("이 페이지 이미지로 내보내기", systemImage: "photo")
            }

            Divider()

            Button {
                showSettings = true
            } label: {
                Label("노트 정보 수정", systemImage: "pencil")
            }

            Button(role: .destructive) {
                showDeletePageConfirm = true
            } label: {
                Label("이 페이지 삭제", systemImage: "trash")
            }
            .disabled(model.pages.count <= 1)
        } label: {
            Image(systemName: "ellipsis.circle")
        }
    }

    private func close() async {
        isClosing = true
        await model.flushAndWait()
        isClosing = false
        dismiss()
    }

    private func exportPDF() async {
        isExporting = true
        defer { isExporting = false }
        do {
            shareItems = [try await model.exportPDF()]
        } catch {
            model.errorMessage = "PDF를 만들지 못했어요: \(error.localizedDescription)"
        }
    }

    private func exportImage() {
        do {
            shareItems = [try model.exportCurrentPageImage()]
        } catch {
            model.errorMessage = "이미지를 만들지 못했어요: \(error.localizedDescription)"
        }
    }
}

/// 페이지 한눈에 보기 (탭하면 이동)
private struct NotebookPageGridView: View {
    @ObservedObject var model: NotebookEditorModel
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(Array(model.pages.enumerated()), id: \.element.id) { index, page in
                        Button {
                            dismiss()
                            Task { await model.showPage(at: index) }
                        } label: {
                            VStack(spacing: 6) {
                                NotebookPreviewImage(path: page.previewPath, version: page.updatedAt)
                                    .aspectRatio(NotebookPageLayout.defaultSize.width / NotebookPageLayout.defaultSize.height, contentMode: .fit)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .stroke(index == model.currentIndex ? Color.green : Color.gray.opacity(0.3),
                                                    lineWidth: index == model.currentIndex ? 3 : 1)
                                    )
                                Text("\(index + 1)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
            .navigationTitle("페이지")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("닫기") { dismiss() }
                }
            }
        }
    }
}

/// Storage에 있는 미리보기 이미지 (없으면 빈 종이)
struct NotebookPreviewImage: View {
    let path: String?
    let version: String?

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color.white
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .task(id: "\(path ?? "")@\(version ?? "")") {
            guard let path else {
                image = nil
                return
            }
            if let data = try? await NotebookFileCache.data(path: path, version: version ?? ""),
               let loaded = UIImage(data: data) {
                image = loaded
            }
        }
    }
}
