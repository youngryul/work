import SwiftUI

/// 웹 RecordForm — 프로젝트명 / 날짜 / 제목 / 내용
struct ProjectRecordFormView: View {
    let initialRecord: ProjectRecordItem?
    let prefillProjectName: String?
    var onSaved: () -> Void
    var onCancel: () -> Void

    @State private var projectName = ""
    @State private var date = Date()
    @State private var title = ""
    @State private var content = ""
    @State private var existingNames: [String] = []
    @State private var isSaving = false
    @State private var errorMessage = ""

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

                    if !filteredNames.isEmpty && !isEdit {
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

                Section("기록") {
                    DatePicker(
                        "작성일",
                        selection: $date,
                        displayedComponents: .date
                    )
                    .environment(\.locale, Locale(identifier: "ko_KR"))

                    TextField("제목", text: $title)

                    TextEditor(text: $content)
                        .frame(minHeight: 160)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(isEdit ? "기록 수정" : "새 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", action: onCancel)
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "저장 중…" : "저장") {
                        Task { await save() }
                    }
                    .disabled(isSaving || !canSave)
                    .fontWeight(.semibold)
                }
            }
            .task {
                await loadNames()
                applyInitial()
            }
        }
    }

    private var canSave: Bool {
        !projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func applyInitial() {
        if let record = initialRecord {
            projectName = record.projectName
            title = record.title
            content = record.content
            if let d = Self.dayFormatter.date(from: record.date) {
                date = d
            }
        } else if let prefill = prefillProjectName, !prefill.isEmpty {
            projectName = prefill
        }
    }

    @MainActor
    private func loadNames() async {
        do {
            existingNames = try await SupabaseService.shared.fetchProjectNames()
        } catch {
            // 자동완성 실패는 무시
        }
    }

    @MainActor
    private func save() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = ""
        defer { isSaving = false }

        let dateStr = Self.dayFormatter.string(from: date)
        do {
            if let record = initialRecord {
                _ = try await SupabaseService.shared.updateProjectRecord(
                    id: record.id,
                    projectName: projectName,
                    date: dateStr,
                    title: title,
                    content: content
                )
            } else {
                _ = try await SupabaseService.shared.createProjectRecord(
                    projectName: projectName,
                    date: dateStr,
                    title: title,
                    content: content
                )
            }
            onSaved()
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }
}
