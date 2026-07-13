import SwiftUI

struct BacklogView: View {
    @State private var tasks: [TaskItem] = []
    @State private var categories: [CategoryItem] = []
    @State private var selectedCategoryName: String = CategoryConstants.fallbackDefaultName
    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""
    @State private var showAddSheet: Bool = false
    @State private var newTaskTitle: String = ""
    @State private var isSaving: Bool = false

    var body: some View {
        NavigationView {
            Group {
                if isLoading && tasks.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if tasks.isEmpty {
                    VStack(spacing: 16) {
                        Text("🥔")
                            .font(.system(size: 60))
                        Text("백로그가 비어있어요!")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Text("+ 버튼으로 할일을 추가해보세요")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(tasks) { task in
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(task.displayTitle)
                                        .font(.body)
                                    if let cat = task.category, cat != "작업", !cat.isEmpty {
                                        Text(cat)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }

                                Spacer()

                                Button {
                                    Task { await moveToToday(task) }
                                } label: {
                                    Image(systemName: "arrow.up.circle.fill")
                                        .foregroundColor(.green)
                                        .font(.title3)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.vertical, 4)
                        }
                        .onDelete { indexSet in
                            Task { await deleteTasks(at: indexSet) }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("백로그")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newTaskTitle = ""
                        Task { await prepareAddSheet() }
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .refreshable {
                await loadTasks()
            }
            .sheet(isPresented: $showAddSheet) {
                addBacklogSheet
            }
            .alert("오류", isPresented: Binding(get: { !errorMessage.isEmpty }, set: { _ in errorMessage = "" })) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
        }
        .task {
            await loadTasks()
        }
    }

    private var addBacklogSheet: some View {
        NavigationView {
            Form {
                Section("할일") {
                    TextField("할일 제목", text: $newTaskTitle)
                }

                Section("카테고리") {
                    if categories.isEmpty {
                        Text("카테고리를 불러오는 중...")
                            .foregroundColor(.secondary)
                    } else {
                        Picker("카테고리", selection: $selectedCategoryName) {
                            ForEach(categories) { category in
                                Text(category.displayName)
                                    .tag(category.name)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }
            }
            .navigationTitle("백로그 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { showAddSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("추가") {
                        Task { await addBacklogTask() }
                    }
                    .disabled(
                        newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty
                            || selectedCategoryName.isEmpty
                            || isSaving
                    )
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func prepareAddSheet() async {
        do {
            if categories.isEmpty {
                categories = try await SupabaseService.shared.fetchCategories()
            }
            let defaultName = try await SupabaseService.shared.fetchDefaultCategoryName()
            if categories.contains(where: { $0.name == defaultName }) {
                selectedCategoryName = defaultName
            } else if let first = categories.first {
                selectedCategoryName = first.name
            }
            showAddSheet = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadTasks() async {
        isLoading = true
        errorMessage = ""
        do {
            tasks = try await SupabaseService.shared.fetchBacklogTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func moveToToday(_ task: TaskItem) async {
        do {
            try await SupabaseService.shared.moveToToday(id: task.id)
            tasks.removeAll { $0.id == task.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteTasks(at indexSet: IndexSet) async {
        let toDelete = indexSet.map { tasks[$0] }
        do {
            for task in toDelete {
                try await SupabaseService.shared.deleteTask(id: task.id)
            }
            tasks.remove(atOffsets: indexSet)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func addBacklogTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }

        isSaving = true
        defer { isSaving = false }

        do {
            try await SupabaseService.shared.addBacklogTask(
                title: title,
                category: selectedCategoryName
            )
            showAddSheet = false
            newTaskTitle = ""
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
