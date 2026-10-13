import SwiftUI

/// 웹 RecordForm — 프로젝트명 / 날짜 / 제목 / 내용, 입력 후 자동 저장
/// - 새 기록은 프로젝트명과 제목이 채워지면 처음 저장 시 생성하고, 이후에는 수정으로 저장한다.
struct ProjectRecordFormView: View {
    let initialRecord: ProjectRecordItem?
    let prefillProjectName: String?
    /// 한 번이라도 저장된 뒤 화면이 닫힐 때 호출 (목록 새로고침용)
    var onSaved: () -> Void
    /// 저장된 내용 없이 닫힐 때 호출
    var onCancel: () -> Void

    @State private var projectName = ""
    @State private var date = Date()
    @State private var title = ""
    @State private var content = ""
    @State private var existingNames: [String] = []
    @State private var errorMessage = ""

    // 자동 저장 상태
    @State private var recordId: String?
    @State private var isLoaded = false
    @State private var isSaving = false
    @State private var savedAt: Date?
    @State private var lastSaved: Draft?
    @State private var saveTask: Task<Void, Never>?
    @State private var didSaveOnce = false
    @State private var didFinish = false

    private struct Draft: Equatable {
        var projectName: String
        var date: String
        var title: String
        var content: String
    }

    private var draft: Draft {
        Draft(
            projectName: projectName,
            date: Self.dayFormatter.string(from: date),
            title: title,
            content: content
        )
    }

    private var isEdit: Bool { initialRecord != nil }

    private var filteredNames: [String] {
        let q = projectName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return Array(existingNames.prefix(8)) }
        return existingNames
            .filter { $0.lowercased().contains(q) }
            .prefix(8)
            .map { $0 }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var body: some View {
        NavigationStack {
            Form {
                Section("프로젝트") {
                    TextField("프로젝트명", text: $projectName)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    if !filteredNames.isEmpty && !isEdit && recordId == nil {
                        ForEach(filteredNames, id: \.self) { name in
                            Button {
                                projectName = name
                            } label: {
                                Label(name, systemImage: "folder")
                                    .foregroundStyle(.primary)
                            }
                        }
                    }
                }

                Section {
                    DatePicker(
                        "작성일",
                        selection: $date,
                        displayedComponents: .date
                    )
                    .environment(\.locale, Locale(identifier: "ko_KR"))

                    TextField("제목", text: $title)

                    TextEditor(text: $content)
                        .frame(minHeight: 160)
                } header: {
                    Text("기록")
                } footer: {
                    if !canSave {
                        Text("프로젝트명과 제목을 입력하면 자동으로 저장돼요.")
                    }
                }
            }
            .navigationTitle(isEdit ? "기록 수정" : "새 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(isEdit ? "기록 수정" : "새 기록")
                            .font(.headline)
                        if !statusText.isEmpty {
                            Text(statusText)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("완료") {
                        Task { await finish() }
                    }
                    .fontWeight(.semibold)
                }
            }
            .task {
                applyInitial()
                await loadNames()
            }
            .onChange(of: draft) { _, _ in scheduleSave() }
            .onDisappear { flushOnClose() }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { if !$0 { errorMessage = "" } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    private var statusText: String {
        if isSaving { return "저장 중…" }
        if savedAt != nil { return "저장됨" }
        return ""
    }

    private var canSave: Bool {
        !projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func applyInitial() {
        guard !isLoaded else { return }
        if let record = initialRecord {
            recordId = record.id
            projectName = record.projectName
            title = record.title
            content = record.content
            if let d = Self.dayFormatter.date(from: record.date) {
                date = d
            }
            // 불러온 내용 그대로는 다시 저장하지 않는다
            lastSaved = draft
        } else if let prefill = prefillProjectName, !prefill.isEmpty {
            projectName = prefill
        }
        isLoaded = true
    }

    @MainActor
    private func loadNames() async {
        do {
            existingNames = try await SupabaseService.shared.fetchProjectNames()
        } catch {
            // 자동완성 실패는 무시
        }
    }

    // MARK: - 자동 저장

    /// 입력이 멈춘 뒤 1.5초 후 저장 (대학원 기록과 동일한 debounce)
    private func scheduleSave() {
        guard isLoaded, !didFinish else { return }
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if Task.isCancelled { return }
            await saveNow()
        }
    }

    /// 현재 입력을 저장한다. 저장할 변경이 없거나 성공하면 true
    @MainActor
    @discardableResult
    private func saveNow() async -> Bool {
        // 앞선 저장이 끝난 뒤 진행해 새 기록이 중복 생성되지 않게 한다
        while isSaving {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard isLoaded, canSave else { return true }
        let snapshot = draft
        guard snapshot != lastSaved else { return true }

        isSaving = true
        defer { isSaving = false }
        do {
            if let id = recordId {
                _ = try await SupabaseService.shared.updateProjectRecord(
                    id: id,
                    projectName: snapshot.projectName,
                    date: snapshot.date,
                    title: snapshot.title,
                    content: snapshot.content
                )
            } else {
                let created = try await SupabaseService.shared.createProjectRecord(
                    projectName: snapshot.projectName,
                    date: snapshot.date,
                    title: snapshot.title,
                    content: snapshot.content
                )
                recordId = created.id
            }
            lastSaved = snapshot
            savedAt = Date()
            didSaveOnce = true
            return true
        } catch {
            if !error.isCancellation {
                errorMessage = "저장하지 못했습니다: \(error.localizedDescription)"
            }
            return false
        }
    }

    /// 완료: 대기 중인 변경을 바로 저장한 뒤 닫는다 (실패하면 작성 내용을 잃지 않도록 머문다)
    @MainActor
    private func finish() async {
        saveTask?.cancel()
        guard await saveNow() else { return }
        didFinish = true
        if didSaveOnce { onSaved() } else { onCancel() }
    }

    /// 아래로 쓸어 닫는 등 완료 버튼 없이 닫힐 때 대기 중인 변경을 저장한다
    /// - 화면이 사라진 뒤에는 상태 값을 믿을 수 없어 지금 값을 캡처해서 저장한다.
    private func flushOnClose() {
        guard !didFinish else { return }
        didFinish = true
        saveTask?.cancel()

        let snapshot = draft
        let id = recordId
        let savedBefore = didSaveOnce
        let callback = onSaved
        // 첫 생성 요청이 진행 중이면 중복 생성을 막기 위해 추가 저장은 생략한다
        let needsSave = isLoaded && canSave && snapshot != lastSaved && !(isSaving && id == nil)
        guard needsSave else {
            if savedBefore || isSaving { callback() }
            return
        }

        Task {
            do {
                if let id {
                    _ = try await SupabaseService.shared.updateProjectRecord(
                        id: id,
                        projectName: snapshot.projectName,
                        date: snapshot.date,
                        title: snapshot.title,
                        content: snapshot.content
                    )
                } else {
                    _ = try await SupabaseService.shared.createProjectRecord(
                        projectName: snapshot.projectName,
                        date: snapshot.date,
                        title: snapshot.title,
                        content: snapshot.content
                    )
                }
                await MainActor.run { callback() }
            } catch {
                if savedBefore { await MainActor.run { callback() } }
            }
        }
    }
}
