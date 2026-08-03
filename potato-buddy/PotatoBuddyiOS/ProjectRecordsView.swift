import SwiftUI

/// 웹 프로젝트 기록(RecordMainView) — 프로젝트 목록 → 상세(메인+기록)
struct ProjectRecordsView: View {
    @State private var projects: [ProjectCountItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showForm = false
    @State private var formPrefillProject: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && projects.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if projects.isEmpty {
                    emptyState
                } else {
                    List(projects) { project in
                        NavigationLink(value: project.projectName) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(project.projectName)
                                        .font(.body.weight(.semibold))
                                    Text("기록 \(project.count)개")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable { await loadProjects() }
                }
            }
            .navigationTitle("프로젝트 기록")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        formPrefillProject = nil
                        showForm = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .navigationDestination(for: String.self) { name in
                ProjectRecordsDetailView(projectName: name) {
                    Task { await loadProjects() }
                }
            }
            .sheet(isPresented: $showForm) {
                ProjectRecordFormView(
                    initialRecord: nil,
                    prefillProjectName: formPrefillProject,
                    onSaved: {
                        showForm = false
                        Task { await loadProjects() }
                    },
                    onCancel: { showForm = false }
                )
            }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { _ in errorMessage = "" }
            )) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
            .task { await loadProjects() }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Text("📁")
                .font(.system(size: 48))
            Text("프로젝트 기록이 없습니다")
                .font(.headline)
            Text("오른쪽 위 + 로 첫 기록을 추가하면\n프로젝트가 만들어져요.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("새 기록 작성") {
                formPrefillProject = nil
                showForm = true
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func loadProjects() async {
        isLoading = true
        defer { isLoading = false }
        do {
            projects = try await SupabaseService.shared.fetchProjectCounts()
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - 프로젝트 상세

struct ProjectRecordsDetailView: View {
    let projectName: String
    var onChanged: () -> Void

    @State private var mainRecord: ProjectRecordItem?
    @State private var records: [ProjectRecordItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showForm = false
    @State private var editingRecord: ProjectRecordItem?
    @State private var selectedRecord: ProjectRecordItem?
    @State private var recordToDelete: ProjectRecordItem?

    var body: some View {
        Group {
            if isLoading && records.isEmpty && mainRecord == nil {
                ProgressView("불러오는 중...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        if let main = mainRecord {
                            mainCard(main)
                        } else {
                            Text("메인으로 지정된 기록이 없습니다.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    } header: {
                        Text("메인 기록")
                    }

                    Section {
                        if records.isEmpty {
                            Text("기록이 없습니다.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(records) { record in
                                Button {
                                    selectedRecord = record
                                } label: {
                                    recordRow(record)
                                }
                                .buttonStyle(.plain)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        recordToDelete = record
                                    } label: {
                                        Label("삭제", systemImage: "trash")
                                    }
                                    Button {
                                        editingRecord = record
                                        showForm = true
                                    } label: {
                                        Label("수정", systemImage: "pencil")
                                    }
                                    .tint(.blue)
                                }
                            }
                        }
                    } header: {
                        Text("기록 목록")
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable { await loadData() }
            }
        }
        .navigationTitle(projectName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    editingRecord = nil
                    showForm = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundColor(.green)
                }
            }
        }
        .sheet(isPresented: $showForm) {
            ProjectRecordFormView(
                initialRecord: editingRecord,
                prefillProjectName: editingRecord == nil ? projectName : nil,
                onSaved: {
                    showForm = false
                    editingRecord = nil
                    Task {
                        await loadData()
                        onChanged()
                    }
                },
                onCancel: {
                    showForm = false
                    editingRecord = nil
                }
            )
        }
        .sheet(item: $selectedRecord) { record in
            ProjectRecordDetailSheet(
                record: record,
                onEdit: {
                    selectedRecord = nil
                    editingRecord = record
                    showForm = true
                },
                onDelete: {
                    selectedRecord = nil
                    recordToDelete = record
                },
                onToggleMain: {
                    Task {
                        await toggleMain(record)
                        selectedRecord = nil
                    }
                },
                onDismiss: { selectedRecord = nil }
            )
        }
        .confirmationDialog(
            "기록 삭제",
            isPresented: Binding(
                get: { recordToDelete != nil },
                set: { if !$0 { recordToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("삭제", role: .destructive) {
                if let record = recordToDelete {
                    Task { await deleteRecord(record) }
                }
                recordToDelete = nil
            }
            Button("취소", role: .cancel) {
                recordToDelete = nil
            }
        } message: {
            Text("'\(recordToDelete?.title ?? "")' 기록을 정말 삭제할까요?")
        }
        .alert("오류", isPresented: Binding(
            get: { !errorMessage.isEmpty },
            set: { _ in errorMessage = "" }
        )) {
            Button("확인") { errorMessage = "" }
        } message: {
            Text(errorMessage)
        }
        .task { await loadData() }
    }

    @ViewBuilder
    private func mainCard(_ record: ProjectRecordItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("메인")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.green.opacity(0.2)))
                    .foregroundColor(.green)
                Spacer()
                Text(record.displayDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(record.title)
                .font(.headline)
            if !record.content.isEmpty {
                Text(record.content)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            }
            HStack {
                Button("자세히") { selectedRecord = record }
                    .font(.caption.weight(.semibold))
                Spacer()
                Button("메인 해제") {
                    Task { await unsetMain(record) }
                }
                .font(.caption)
                .foregroundColor(.orange)
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 4)
    }

    private func recordRow(_ record: ProjectRecordItem) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(record.displayDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if record.isMain {
                        Text("메인")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.green)
                    }
                }
                Text(record.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }

    @MainActor
    private func loadData() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let main = SupabaseService.shared.fetchMainProjectRecord(projectName: projectName)
            async let list = SupabaseService.shared.fetchProjectRecords(projectName: projectName)
            mainRecord = try await main
            records = try await list
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }

    @MainActor
    private func deleteRecord(_ record: ProjectRecordItem) async {
        do {
            try await SupabaseService.shared.deleteProjectRecord(id: record.id)
            await loadData()
            onChanged()
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }

    @MainActor
    private func toggleMain(_ record: ProjectRecordItem) async {
        do {
            if record.isMain {
                try await SupabaseService.shared.unsetMainProjectRecord(id: record.id)
            } else {
                try await SupabaseService.shared.setMainProjectRecord(id: record.id, projectName: projectName)
            }
            await loadData()
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }

    @MainActor
    private func unsetMain(_ record: ProjectRecordItem) async {
        do {
            try await SupabaseService.shared.unsetMainProjectRecord(id: record.id)
            await loadData()
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - 기록 상세 시트

private struct ProjectRecordDetailSheet: View {
    let record: ProjectRecordItem
    var onEdit: () -> Void
    var onDelete: () -> Void
    var onToggleMain: () -> Void
    var onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text(record.projectName)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.green)
                        Spacer()
                        Text(record.displayDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(record.title)
                        .font(.title2.weight(.bold))
                    if record.isMain {
                        Text("메인 기록")
                            .font(.caption.weight(.bold))
                            .foregroundColor(.green)
                    }
                    Divider()
                    Text(record.content.isEmpty ? "(내용 없음)" : record.content)
                        .font(.body)
                        .foregroundStyle(record.content.isEmpty ? .secondary : .primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding()
            }
            .navigationTitle("기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기", action: onDismiss)
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button(record.isMain ? "메인 해제" : "메인 기록으로 설정", action: onToggleMain)
                        Button("수정", action: onEdit)
                        Button("삭제", role: .destructive, action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
