import SwiftUI
import PhotosUI
import UIKit

/// 웹 GraduateNoteModal과 대응 — 블록 에디터 (본문/제목1/제목2/사진/구분선), 입력 후 자동 저장
struct GraduateNoteEditorView: View {
    let note: GraduateNoteItem
    var onSaved: (GraduateNoteItem) -> Void
    var onDeleted: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    /// 저장 대상 묶음 — 이전에 저장한 값과 비교해 변경 여부를 판단한다
    private struct Draft: Equatable {
        var title: String
        var date: Date
        var blocks: [GraduateNoteBlock]
    }

    @State private var title = ""
    @State private var date = Date()
    @State private var blocks: [GraduateNoteBlock] = []
    /// 서버에서 본문을 받아오기 전에는 저장하지 않는다 (빈 본문으로 덮어쓰기 방지)
    @State private var isLoaded = false
    @State private var loadFailed = false
    @State private var lastSaved: Draft?
    @State private var isSaving = false
    @State private var savedAt: Date?
    @State private var saveTask: Task<Void, Never>?
    @State private var isDeleted = false
    @State private var uploadingBlockIds: Set<String> = []
    @State private var photoItem: PhotosPickerItem?
    @State private var showDeleteConfirm = false
    @State private var errorMessage = ""
    @FocusState private var focusedBlockId: String?

    private var draft: Draft {
        Draft(title: title, date: date, blocks: blocks)
    }

    private var categoryLabel: String {
        GraduateNoteCategory(rawValue: note.category)?.label ?? note.category
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoaded {
                    editorContent
                } else if loadFailed {
                    VStack(spacing: 12) {
                        Text("기록을 불러오지 못했어요.")
                            .foregroundStyle(.secondary)
                        Button("다시 시도") {
                            Task { await load() }
                        }
                        .buttonStyle(.bordered)
                        .tint(.green)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(note.subjectName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    Text(statusText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("기록 삭제", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task { await load() }
        .onChange(of: draft) { _, _ in scheduleSave() }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await addPhoto(item) }
        }
        .onDisappear { flushOnClose() }
        .confirmationDialog("이 기록을 삭제할까요?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("삭제", role: .destructive) {
                Task { await deleteNote() }
            }
            Button("취소", role: .cancel) {}
        }
        .alert("오류", isPresented: Binding(
            get: { !errorMessage.isEmpty },
            set: { if !$0 { errorMessage = "" } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    private var statusText: String {
        if isSaving { return "저장 중…" }
        if savedAt != nil { return "저장됨" }
        return ""
    }

    // MARK: - 에디터 본문

    private var editorContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Text(categoryLabel)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.12))
                        .foregroundStyle(.green)
                        .clipShape(Capsule())

                    DatePicker("작성일", selection: $date, displayedComponents: .date)
                        .labelsHidden()
                        .environment(\.locale, Locale(identifier: "ko_KR"))
                    Spacer(minLength: 0)
                }

                TextField("제목 없음", text: $title, axis: .vertical)
                    .font(.title.bold())
                    .padding(.bottom, 4)

                ForEach($blocks) { $block in
                    blockRow($block)
                }

                // 하단 빈 영역을 누르면 새 본문 블록 추가 (웹과 동일)
                Color.clear
                    .frame(height: 80)
                    .contentShape(Rectangle())
                    .onTapGesture { appendParagraphIfNeeded() }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            blockToolbar
        }
    }

    private func blockRow(_ block: Binding<GraduateNoteBlock>) -> some View {
        HStack(alignment: .top, spacing: 6) {
            blockContent(block)
                .frame(maxWidth: .infinity, alignment: .leading)

            Menu {
                Button {
                    move(block.wrappedValue.id, by: -1)
                } label: {
                    Label("위로", systemImage: "arrow.up")
                }
                Button {
                    move(block.wrappedValue.id, by: 1)
                } label: {
                    Label("아래로", systemImage: "arrow.down")
                }
                Button(role: .destructive) {
                    deleteBlock(block.wrappedValue.id)
                } label: {
                    Label("블록 삭제", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
        }
    }

    @ViewBuilder
    private func blockContent(_ block: Binding<GraduateNoteBlock>) -> some View {
        let id = block.wrappedValue.id
        switch block.wrappedValue.type {
        case GraduateBlockType.heading1:
            TextField("제목1", text: block.content, axis: .vertical)
                .font(.title2.bold())
                .focused($focusedBlockId, equals: id)
        case GraduateBlockType.heading2:
            TextField("제목2", text: block.content, axis: .vertical)
                .font(.title3.weight(.semibold))
                .focused($focusedBlockId, equals: id)
        case GraduateBlockType.image:
            imageBlock(block.wrappedValue)
        case GraduateBlockType.divider:
            Divider().padding(.vertical, 10)
        default:
            TextField("내용을 입력하세요...", text: block.content, axis: .vertical)
                .font(.body)
                .focused($focusedBlockId, equals: id)
        }
    }

    @ViewBuilder
    private func imageBlock(_ block: GraduateNoteBlock) -> some View {
        if uploadingBlockIds.contains(block.id) {
            HStack(spacing: 8) {
                ProgressView()
                Text("업로드 중...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 100)
            .background(Color(UIColor.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        } else if !block.content.isEmpty, let url = URL(string: block.content) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                case .failure:
                    Label("이미지를 불러오지 못했어요", systemImage: "exclamationmark.triangle")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 80)
                default:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                }
            }
        } else {
            Label("이미지 없음", systemImage: "photo")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 80)
                .background(Color(UIColor.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - 블록 추가 툴바

    private var blockToolbar: some View {
        HStack(spacing: 22) {
            Button {
                addBlock(GraduateBlockType.paragraph)
            } label: {
                Image(systemName: "text.alignleft")
            }
            .accessibilityLabel("본문 추가")

            Button {
                addBlock(GraduateBlockType.heading1)
            } label: {
                Text("H1").font(.subheadline.weight(.bold))
            }
            .accessibilityLabel("제목1 추가")

            Button {
                addBlock(GraduateBlockType.heading2)
            } label: {
                Text("H2").font(.subheadline.weight(.bold))
            }
            .accessibilityLabel("제목2 추가")

            PhotosPicker(selection: $photoItem, matching: .images) {
                Image(systemName: "photo")
            }
            .accessibilityLabel("사진 추가")

            Button {
                addBlock(GraduateBlockType.divider)
            } label: {
                Image(systemName: "minus")
            }
            .accessibilityLabel("구분선 추가")

            Spacer()

            Button {
                focusedBlockId = nil
            } label: {
                Image(systemName: "keyboard.chevron.compact.down")
            }
            .accessibilityLabel("키보드 닫기")
        }
        .font(.title3)
        .tint(.green)
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    // MARK: - 블록 편집

    private func addBlock(_ type: String) {
        let block = GraduateNoteBlock(type: type)
        blocks.append(block)
        if type != GraduateBlockType.divider {
            Task { @MainActor in focusedBlockId = block.id }
        }
    }

    private func appendParagraphIfNeeded() {
        if let last = blocks.last,
           last.type == GraduateBlockType.paragraph,
           last.content.isEmpty {
            focusedBlockId = last.id
        } else {
            addBlock(GraduateBlockType.paragraph)
        }
    }

    private func deleteBlock(_ id: String) {
        blocks.removeAll { $0.id == id }
        // 블록이 하나도 없으면 빈 본문 블록을 남겨 계속 입력할 수 있게 한다
        if blocks.isEmpty {
            blocks = [GraduateNoteBlock(type: GraduateBlockType.paragraph)]
        }
    }

    private func move(_ id: String, by offset: Int) {
        guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
        let target = index + offset
        guard blocks.indices.contains(target) else { return }
        blocks.swapAt(index, target)
    }

    // MARK: - 사진 업로드

    @MainActor
    private func addPhoto(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }

        let block = GraduateNoteBlock(type: GraduateBlockType.image)
        blocks.append(block)
        uploadingBlockIds.insert(block.id)
        defer { uploadingBlockIds.remove(block.id) }

        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let jpeg = Self.compressedJPEG(from: data) else {
                throw NSError(
                    domain: "GraduateNoteEditor",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "사진을 읽지 못했습니다."]
                )
            }
            let url = try await SupabaseService.shared.uploadGraduateNoteImage(jpeg)
            if let index = blocks.firstIndex(where: { $0.id == block.id }) {
                blocks[index].content = url
            }
        } catch {
            blocks.removeAll { $0.id == block.id }
            if !error.isCancellation {
                errorMessage = "이미지 업로드 실패: \(error.localizedDescription)"
            }
        }
    }

    /// 긴 변 1600px 이하 JPEG로 줄인다 (Storage 업로드 용량 제한 대비)
    private static func compressedJPEG(from data: Data, maxDimension: CGFloat = 1600) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { return nil }
        let scale = longest > maxDimension ? maxDimension / longest : 1
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: 0.8)
    }

    // MARK: - 불러오기 / 저장 / 삭제

    @MainActor
    private func load() async {
        guard !isLoaded else { return }
        loadFailed = false
        do {
            let full = try await SupabaseService.shared.fetchGraduateNote(id: note.id)
            title = full.title
            date = GraduateNoteDate.date(from: full.noteDate) ?? Date()
            blocks = full.content.isEmpty
                ? [GraduateNoteBlock(type: GraduateBlockType.paragraph)]
                : full.content
            lastSaved = draft
            isLoaded = true
        } catch {
            if !error.isCancellation {
                loadFailed = true
                errorMessage = error.localizedDescription
            }
        }
    }

    /// 입력이 멈춘 뒤 1.5초 후 저장 (웹 자동 저장과 동일한 debounce)
    private func scheduleSave() {
        guard isLoaded, !isDeleted else { return }
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if Task.isCancelled { return }
            await saveNow()
        }
    }

    @MainActor
    private func saveNow() async {
        guard isLoaded, !isDeleted else { return }
        let snapshot = draft
        guard snapshot != lastSaved else { return }

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await SupabaseService.shared.updateGraduateNote(
                id: note.id,
                title: snapshot.title,
                blocks: snapshot.blocks,
                noteDate: GraduateNoteDate.string(from: snapshot.date)
            )
            lastSaved = snapshot
            savedAt = Date()
            onSaved(updated)
        } catch {
            if !error.isCancellation {
                errorMessage = "저장하지 못했습니다: \(error.localizedDescription)"
            }
        }
    }

    /// 시트가 닫힐 때 debounce 대기 중인 변경을 바로 저장한다
    private func flushOnClose() {
        saveTask?.cancel()
        guard isLoaded, !isDeleted, uploadingBlockIds.isEmpty else { return }
        let snapshot = draft
        guard snapshot != lastSaved else { return }

        let id = note.id
        let callback = onSaved
        Task {
            if let updated = try? await SupabaseService.shared.updateGraduateNote(
                id: id,
                title: snapshot.title,
                blocks: snapshot.blocks,
                noteDate: GraduateNoteDate.string(from: snapshot.date)
            ) {
                await MainActor.run { callback(updated) }
            }
        }
    }

    @MainActor
    private func deleteNote() async {
        do {
            try await SupabaseService.shared.deleteGraduateNote(id: note.id)
            isDeleted = true
            saveTask?.cancel()
            onDeleted(note.id)
            dismiss()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
