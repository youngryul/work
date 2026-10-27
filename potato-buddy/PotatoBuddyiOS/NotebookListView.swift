import SwiftUI
import PDFKit
import UniformTypeIdentifiers

/// 필기 노트 목록 (노트 만들기·PDF 가져오기·손글씨 검색)
struct NotebookListView: View {
    /// 편집 화면으로 열 대상
    private struct OpenTarget: Identifiable {
        let notebook: Notebook
        let pageId: String?
        var id: String { notebook.id + (pageId ?? "") }
    }

    /// PDF 한 개로 만들 수 있는 최대 페이지 수
    private static let maxPdfPages = 300
    private static let searchDelayNanoseconds: UInt64 = 400_000_000

    @State private var notebooks: [Notebook] = []
    @State private var isLoading = false
    @State private var isImporting = false
    @State private var errorMessage: String?
    @State private var showCreate = false
    @State private var showPdfImporter = false
    @State private var editingNotebook: Notebook?
    @State private var deletingNotebook: Notebook?
    @State private var openTarget: OpenTarget?
    /// 새 노트 시트가 닫히면 열 대상
    @State private var pendingOpen: OpenTarget?
    @State private var searchText = ""
    @State private var searchResults: [NotebookPage] = []
    @State private var isSearching = false

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 18)]

    private var trimmedQuery: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filteredNotebooks: [Notebook] {
        guard !trimmedQuery.isEmpty else { return notebooks }
        return notebooks.filter { $0.displayTitle.localizedCaseInsensitiveContains(trimmedQuery) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if trimmedQuery.isEmpty {
                    notebookGrid(notebooks)
                } else {
                    searchContent
                }
            }
            .overlay {
                if isLoading && notebooks.isEmpty {
                    ProgressView()
                } else if !isLoading && notebooks.isEmpty && trimmedQuery.isEmpty {
                    ContentUnavailableView(
                        "노트가 없어요",
                        systemImage: "pencil.and.scribble",
                        description: Text("오른쪽 위 + 버튼으로 새 노트를 만들거나 PDF를 가져와 필기해 보세요.")
                    )
                }
                if isImporting {
                    VStack(spacing: 10) {
                        ProgressView()
                        Text("PDF를 가져오는 중…")
                            .font(.footnote)
                    }
                    .padding(20)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .navigationTitle("필기 노트")
            .searchable(text: $searchText, prompt: "노트 제목·손글씨 검색")
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showCreate = true
                        } label: {
                            Label("새 노트", systemImage: "square.and.pencil")
                        }
                        Button {
                            showPdfImporter = true
                        } label: {
                            Label("PDF 가져오기", systemImage: "doc.badge.arrow.up")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                    .disabled(isImporting)
                }
            }
        }
        .task { await load() }
        .task(id: trimmedQuery) { await search(trimmedQuery) }
        .sheet(isPresented: $showCreate, onDismiss: {
            // 시트가 완전히 닫힌 뒤에 편집 화면을 띄운다
            if let pendingOpen {
                openTarget = pendingOpen
                self.pendingOpen = nil
            }
        }) {
            NotebookFormView(notebook: nil) { title, cover, paper in
                await create(title: title, cover: cover, paper: paper)
            }
        }
        .sheet(item: $editingNotebook) { notebook in
            NotebookFormView(notebook: notebook) { title, cover, paper in
                await update(notebook, title: title, cover: cover, paper: paper)
            }
        }
        .fileImporter(isPresented: $showPdfImporter, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result {
                Task { await importPDF(url) }
            }
        }
        .fullScreenCover(item: $openTarget, onDismiss: {
            Task { await load() }
        }) { target in
            NotebookEditorView(notebook: target.notebook, initialPageId: target.pageId)
        }
        .confirmationDialog(
            "노트를 지울까요?",
            isPresented: Binding(get: { deletingNotebook != nil }, set: { if !$0 { deletingNotebook = nil } }),
            titleVisibility: .visible
        ) {
            Button("노트 삭제", role: .destructive) {
                if let deletingNotebook { Task { await delete(deletingNotebook) } }
                deletingNotebook = nil
            }
            Button("취소", role: .cancel) { deletingNotebook = nil }
        } message: {
            Text("모든 페이지와 필기가 함께 지워져요.")
        }
        .alert("알림", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func notebookGrid(_ items: [Notebook]) -> some View {
        LazyVGrid(columns: columns, spacing: 22) {
            ForEach(items) { notebook in
                Button {
                    openTarget = OpenTarget(notebook: notebook, pageId: nil)
                } label: {
                    NotebookCoverCell(notebook: notebook)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button {
                        editingNotebook = notebook
                    } label: {
                        Label("이름·표지 수정", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        deletingNotebook = notebook
                    } label: {
                        Label("삭제", systemImage: "trash")
                    }
                }
            }
        }
        .padding()
    }

    @ViewBuilder
    private var searchContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !filteredNotebooks.isEmpty {
                Text("노트")
                    .font(.headline)
                    .padding(.horizontal)
                notebookGrid(filteredNotebooks)
            }

            Text("손글씨에서 찾은 페이지")
                .font(.headline)
                .padding(.horizontal)

            if isSearching {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if searchResults.isEmpty {
                Text("일치하는 페이지가 없어요.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(searchResults) { page in
                        searchRow(page)
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical)
    }

    private func searchRow(_ page: NotebookPage) -> some View {
        Button {
            guard let notebook = notebooks.first(where: { $0.id == page.notebookId }) else { return }
            openTarget = OpenTarget(notebook: notebook, pageId: page.id)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                NotebookPreviewImage(path: page.previewPath, version: page.updatedAt)
                    .frame(width: 56, height: 79)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(page.notebookTitle.flatMap { $0.isEmpty ? nil : $0 } ?? "제목 없는 노트")
                        .font(.subheadline.weight(.semibold))
                    Text(snippet(of: page.recognizedText))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    /// 검색어 주변 글자만 잘라서 보여준다
    private func snippet(of text: String) -> String {
        guard let range = text.range(of: trimmedQuery, options: .caseInsensitive) else {
            return String(text.prefix(80))
        }
        let start = text.index(range.lowerBound, offsetBy: -30, limitedBy: text.startIndex) ?? text.startIndex
        let end = text.index(range.upperBound, offsetBy: 50, limitedBy: text.endIndex) ?? text.endIndex
        let prefix = start > text.startIndex ? "…" : ""
        let suffix = end < text.endIndex ? "…" : ""
        return prefix + String(text[start..<end]) + suffix
    }

    // MARK: 동작

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            notebooks = try await SupabaseService.shared.fetchNotebooks()
        } catch {
            errorMessage = "노트를 불러오지 못했어요: \(error.localizedDescription)"
        }
    }

    private func search(_ query: String) async {
        guard !query.isEmpty else {
            searchResults = []
            return
        }
        try? await Task.sleep(nanoseconds: Self.searchDelayNanoseconds)
        guard !Task.isCancelled else { return }
        isSearching = true
        defer { isSearching = false }
        searchResults = (try? await SupabaseService.shared.searchNotebookPages(query: query)) ?? []
    }

    private func create(title: String, cover: NotebookCoverColor, paper: NotebookPaperType) async {
        do {
            let notebook = try await SupabaseService.shared.createNotebook(title: title, coverColor: cover, paperType: paper)
            _ = try await SupabaseService.shared.createNotebookPages(
                notebookId: notebook.id,
                pages: [NotebookNewPage(pageOrder: 1, paperType: paper)]
            )
            notebooks.insert(notebook, at: 0)
            pendingOpen = OpenTarget(notebook: notebook, pageId: nil)
        } catch {
            errorMessage = "노트를 만들지 못했어요: \(error.localizedDescription)"
        }
    }

    private func update(_ notebook: Notebook, title: String, cover: NotebookCoverColor, paper: NotebookPaperType) async {
        do {
            let updated = try await SupabaseService.shared.updateNotebook(
                id: notebook.id,
                title: title,
                coverColor: cover,
                paperType: paper
            )
            if let index = notebooks.firstIndex(where: { $0.id == notebook.id }) {
                notebooks[index] = updated
            }
        } catch {
            errorMessage = "노트 정보를 저장하지 못했어요: \(error.localizedDescription)"
        }
    }

    private func delete(_ notebook: Notebook) async {
        do {
            try await SupabaseService.shared.deleteNotebook(notebook)
            notebooks.removeAll { $0.id == notebook.id }
        } catch {
            errorMessage = "노트를 지우지 못했어요: \(error.localizedDescription)"
        }
    }

    /// PDF를 올리고 페이지마다 PDF 페이지를 배경으로 하는 노트를 만든다
    private func importPDF(_ url: URL) async {
        isImporting = true
        defer { isImporting = false }

        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }

        do {
            let data = try Data(contentsOf: url)
            guard let document = PDFDocument(data: data), document.pageCount > 0 else {
                errorMessage = "PDF를 열 수 없어요."
                return
            }
            if document.isLocked {
                errorMessage = "암호가 걸린 PDF는 가져올 수 없어요."
                return
            }
            guard document.pageCount <= Self.maxPdfPages else {
                errorMessage = "PDF는 \(Self.maxPdfPages)쪽까지 가져올 수 있어요."
                return
            }

            let service = SupabaseService.shared
            let title = url.deletingPathExtension().lastPathComponent
            var notebook = try await service.createNotebook(title: title, coverColor: .sky, paperType: .lined)
            let pdfPath = await service.notebookStoragePath(notebookId: notebook.id, fileName: "source.pdf")
            try await service.uploadNotebookFile(data, path: pdfPath, contentType: "application/pdf")
            NotebookFileCache.storeFile(data, path: pdfPath, version: "pdf")
            notebook = try await service.updateNotebook(id: notebook.id, pdfPath: pdfPath)

            let newPages = (0..<document.pageCount).map { index in
                NotebookNewPage(pageOrder: Double(index + 1), paperType: .pdf, pdfPageIndex: index)
            }
            _ = try await service.createNotebookPages(notebookId: notebook.id, pages: newPages)

            notebooks.insert(notebook, at: 0)
            openTarget = OpenTarget(notebook: notebook, pageId: nil)
        } catch {
            errorMessage = "PDF를 가져오지 못했어요: \(error.localizedDescription)"
        }
    }
}

/// 노트 표지 칸
private struct NotebookCoverCell: View {
    let notebook: Notebook

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(notebook.cover.color)
                NotebookPreviewImage(path: notebook.firstPage?.previewPath, version: notebook.firstPage?.updatedAt)
                    .padding(.vertical, 10)
                    .padding(.leading, 18)
                    .padding(.trailing, 10)
                    .shadow(color: .black.opacity(0.12), radius: 2, y: 1)
                // 제본 느낌의 왼쪽 띠
                Rectangle()
                    .fill(Color.black.opacity(0.12))
                    .frame(width: 8)
            }
            .aspectRatio(0.75, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            Text(notebook.displayTitle)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Text(notebook.pdfPath == nil ? "\(notebook.pages.count)쪽" : "PDF · \(notebook.pages.count)쪽")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// 노트 만들기·수정 폼
struct NotebookFormView: View {
    let notebook: Notebook?
    var onSubmit: (String, NotebookCoverColor, NotebookPaperType) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var cover: NotebookCoverColor = .green
    @State private var paper: NotebookPaperType = .lined
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("제목") {
                    TextField("노트 이름", text: $title)
                }
                Section("표지 색") {
                    HStack(spacing: 14) {
                        ForEach(NotebookCoverColor.allCases) { color in
                            Circle()
                                .fill(color.color)
                                .frame(width: 32, height: 32)
                                .overlay(
                                    Circle().stroke(Color.primary, lineWidth: cover == color ? 3 : 0)
                                )
                                .onTapGesture { cover = color }
                                .accessibilityAddTraits(cover == color ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    Picker("속지", selection: $paper) {
                        ForEach(NotebookPaperType.selectable) { paper in
                            Text(paper.label).tag(paper)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("새 페이지 속지")
                } footer: {
                    Text("페이지마다 필기 화면의 메뉴에서 따로 바꿀 수 있어요.")
                }
            }
            .navigationTitle(notebook == nil ? "새 노트" : "노트 정보")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(notebook == nil ? "만들기" : "저장") {
                        Task {
                            isSaving = true
                            let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
                            await onSubmit(trimmed, cover, paper)
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .onAppear {
                if let notebook {
                    title = notebook.title
                    cover = notebook.cover
                    paper = notebook.defaultPaper
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
