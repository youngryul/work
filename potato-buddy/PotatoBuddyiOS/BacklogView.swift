import SwiftUI

struct BacklogView: View {
    @State private var tasks: [TaskItem] = []
    @State private var categories: [CategoryItem] = []
    @State private var selectedCategoryName: String = CategoryConstants.fallbackDefaultName
    @State private var isLoadingCategories = false
    @State private var didAttemptCategoryLoad = false
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
                                Text(CategoryConstants.emoji(for: task.category, in: categories))
                                    .font(.system(size: 28))
                                    .accessibilityLabel(task.category ?? "카테고리")

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(task.title)
                                        .font(.body)
                                        .foregroundColor(.primary)

                                    if task.isStaleTwoWeeks {
                                        Text("2주 이상 지남")
                                            .font(.caption2)
                                            .foregroundColor(.primary.opacity(0.75))
                                    } else if task.isStaleOneWeek {
                                        Text("1주 이상 지남")
                                            .font(.caption2)
                                            .foregroundColor(.red.opacity(0.8))
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                Button {
                                    Task { await moveToToday(task) }
                                } label: {
                                    Image(systemName: "arrow.up.circle.fill")
                                        .foregroundColor(.green)
                                        .font(.title3)
                                }
                                .buttonStyle(.borderless)
                            }
                            .padding(.vertical, 4)
                            .listRowBackground(backlogRowBackground(for: task))
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
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .refreshable {
                async let tasksLoad: Void = loadTasks()
                async let categoriesLoad: Void = loadCategories()
                _ = await (tasksLoad, categoriesLoad)
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
            async let tasksLoad: Void = loadTasks()
            async let categoriesLoad: Void = loadCategories()
            _ = await (tasksLoad, categoriesLoad)
        }
    }

    private var addBacklogSheet: some View {
        NavigationView {
            Form {
                Section("할일") {
                    TextField("할일 제목", text: $newTaskTitle)
                }

                Section("카테고리") {
                    if isLoadingCategories || (!didAttemptCategoryLoad && categories.isEmpty) {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("카테고리를 불러오는 중...")
                                .foregroundColor(.secondary)
                        }
                    } else if categories.isEmpty {
                        Text("카테고리를 불러올 수 없어요. 다시 시도해 주세요.")
                            .foregroundColor(.secondary)
                        Button("다시 불러오기") {
                            Task { await loadCategories() }
                        }
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
                            || isLoadingCategories
                            || categories.isEmpty
                    )
                }
            }
            .task {
                await loadCategories()
                await applyDefaultCategorySelection()
            }
        }
        .presentationDetents([.medium])
    }

    private func backlogRowBackground(for task: TaskItem) -> Color {
        if task.isStaleTwoWeeks {
            return Color.red.opacity(0.55)
        }
        if task.isStaleOneWeek {
            return Color.red.opacity(0.22)
        }
        return Color(.secondarySystemGroupedBackground)
    }

    @MainActor
    private func loadCategories() async {
        if isLoadingCategories { return }
        isLoadingCategories = true
        defer {
            isLoadingCategories = false
            didAttemptCategoryLoad = true
        }

        do {
            categories = try await SupabaseService.shared.fetchCategories()
            if !categories.contains(where: { $0.name == selectedCategoryName }) {
                await applyDefaultCategorySelection()
            }
        } catch {
            if categories.isEmpty {
                categories = CategoryConstants.localFallbackList()
            }
            if !categories.contains(where: { $0.name == selectedCategoryName }) {
                selectedCategoryName = categories.first(where: { $0.name == CategoryConstants.fallbackDefaultName })?.name
                    ?? categories.first?.name
                    ?? CategoryConstants.fallbackDefaultName
            }
        }
    }

    @MainActor
    private func applyDefaultCategorySelection() async {
        let defaultName = (try? await SupabaseService.shared.fetchDefaultCategoryName())
            ?? CategoryConstants.fallbackDefaultName
        if categories.contains(where: { $0.name == defaultName }) {
            selectedCategoryName = defaultName
        } else if let first = categories.first {
            selectedCategoryName = first.name
        }
    }

    @MainActor
    private func loadTasks() async {
        isLoading = true
        errorMessage = ""
        defer { isLoading = false }

        do {
            tasks = try await SupabaseService.shared.fetchBacklogTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func moveToToday(_ task: TaskItem) async {
        do {
            try await SupabaseService.shared.moveToToday(id: task.id)
            tasks.removeAll { $0.id == task.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
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

    @MainActor
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
