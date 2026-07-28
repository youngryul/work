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
            ZStack {
                CorkBoardBackground()

                Group {
                    if isLoading && tasks.isEmpty {
                        ProgressView("불러오는 중...")
                            .padding(16)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.9)))
                    } else {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 16) {
                                CorkBoardHeader(
                                    title: "백로그 보드",
                                    subtitle: tasks.isEmpty ? "쌓아두고 천천히" : "\(tasks.count)개의 메모"
                                )

                                if tasks.isEmpty {
                                    CorkBoardEmptyState(
                                        message: "백로그가 비어있어요!",
                                        hint: "+ 버튼으로 할일을 추가해보세요"
                                    )
                                    .frame(maxWidth: .infinity)
                                } else {
                                    LazyVStack(spacing: 18) {
                                        ForEach(Array(tasks.enumerated()), id: \.element.id) { index, task in
                                            BoardStickyNoteCard(
                                                id: task.id,
                                                title: task.title,
                                                caption: backlogCaption(for: task),
                                                captionColor: backlogCaptionColor(for: task),
                                                noteColor: backlogNoteColor(for: task),
                                                primarySystemImage: "arrow.up.circle.fill",
                                                primaryTint: CorkBoardTheme.posilyGreen,
                                                onPrimary: {
                                                    Task { await moveToToday(task) }
                                                },
                                                accessory: {
                                                    Text(CategoryConstants.emoji(for: task.category, in: categories))
                                                        .font(.system(size: 26))
                                                }
                                            )
                                            .padding(.horizontal, CGFloat(8 + (index % 3) * 5))
                                            .contextMenu {
                                                Button(role: .destructive) {
                                                    Task { await deleteTask(task) }
                                                } label: {
                                                    Label("삭제", systemImage: "trash")
                                                }
                                            }
                                        }
                                    }
                                    .padding(.top, 4)
                                }

                                Text("오래 묵은 메모는 살짝 붉게 보여요")
                                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Capsule().fill(CorkBoardTheme.accentBlue.opacity(0.9)))
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 8)
                                    .padding(.bottom, 28)
                            }
                        }
                        .refreshable {
                            async let tasksLoad: Void = loadTasks()
                            async let categoriesLoad: Void = loadCategories()
                            _ = await (tasksLoad, categoriesLoad)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("백로그")
                        .font(.headline)
                        .foregroundColor(CorkBoardTheme.woodFrame)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newTaskTitle = ""
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(CorkBoardTheme.accentYellow, CorkBoardTheme.accentBlue)
                            .font(.title3)
                    }
                }
            }
            .toolbarBackground(CorkBoardTheme.corkBase.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
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

    private func backlogCaption(for task: TaskItem) -> String? {
        var parts: [String] = []
        if let cat = task.category, !cat.isEmpty {
            parts.append(cat)
        }
        if task.isStaleTwoWeeks {
            parts.append("2주 이상")
        } else if task.isStaleOneWeek {
            parts.append("1주 이상")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func backlogCaptionColor(for task: TaskItem) -> Color {
        if task.isStaleTwoWeeks {
            return Color.red.opacity(0.9)
        }
        if task.isStaleOneWeek {
            return Color.red.opacity(0.7)
        }
        return CorkBoardTheme.accentBlue.opacity(0.85)
    }

    private func backlogNoteColor(for task: TaskItem) -> Color? {
        if task.isStaleTwoWeeks {
            return Color(red: 1.0, green: 0.72, blue: 0.72)
        }
        if task.isStaleOneWeek {
            return Color(red: 1.0, green: 0.86, blue: 0.82)
        }
        return nil
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
    private func deleteTask(_ task: TaskItem) async {
        do {
            try await SupabaseService.shared.deleteTask(id: task.id)
            tasks.removeAll { $0.id == task.id }
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
