import SwiftUI

struct TodayView: View {
    private static let completeDelayNanoseconds: UInt64 = 1_000_000_000

    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var tasks: [TaskItem] = []
    @State private var categories: [CategoryItem] = []
    @State private var pendingCompleteIds: Set<String> = []
    @State private var completeGeneration: [String: Int] = [:]
    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""
    @State private var jellyEarnedMessage: String = ""
    @State private var showAddAlert: Bool = false
    @State private var newTaskTitle: String = ""

    private var dateSubtitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter.string(from: Date())
    }

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
                                    title: "오늘 보드",
                                    subtitle: "\(dateSubtitle) · \(tasks.count)개"
                                )

                                if tasks.isEmpty {
                                    CorkBoardEmptyState(
                                        message: "오늘 할일이 없어요!",
                                        hint: "백로그에서 오늘로 이동하거나\n+ 버튼으로 추가해보세요"
                                    )
                                    .frame(maxWidth: .infinity)
                                } else {
                                    LazyVStack(spacing: 18) {
                                        ForEach(Array(tasks.enumerated()), id: \.element.id) { index, task in
                                            let isPending = pendingCompleteIds.contains(task.id)
                                            BoardStickyNoteCard(
                                                id: task.id,
                                                title: task.title,
                                                caption: task.category.flatMap { cat in
                                                    (cat != "작업" && !cat.isEmpty) ? cat : nil
                                                },
                                                captionColor: CorkBoardTheme.accentBlue.opacity(0.85),
                                                isStruckThrough: isPending,
                                                showPrimaryAction: false,
                                                onCardTap: {
                                                    togglePendingComplete(task)
                                                },
                                                accessory: {
                                                    Text(CategoryConstants.emoji(for: task.category, in: categories))
                                                        .font(.system(size: 26))
                                                }
                                            )
                                            .padding(.horizontal, CGFloat(10 + (index % 3) * 4))
                                        }
                                    }
                                    .padding(.top, 4)
                                }

                                motivationBanner
                                    .padding(.top, 8)
                                    .padding(.bottom, 28)
                            }
                            .padding(.bottom, 20)
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
                ToolbarItem(placement: .navigationBarLeading) {
                    JellyBalanceBadgeView()
                }
                ToolbarItem(placement: .principal) {
                    Text("오늘 할일")
                        .font(.headline)
                        .foregroundColor(CorkBoardTheme.woodFrame)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newTaskTitle = ""
                        showAddAlert = true
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
            .alert("할일 추가", isPresented: $showAddAlert) {
                TextField("할일 제목", text: $newTaskTitle)
                Button("추가") {
                    if !newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty {
                        Task { await addTask() }
                    }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("오늘 할일로 추가됩니다")
            }
            .alert("오류", isPresented: Binding(get: { !errorMessage.isEmpty }, set: { _ in errorMessage = "" })) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
            .alert("젤리 획득", isPresented: Binding(get: { !jellyEarnedMessage.isEmpty }, set: { _ in jellyEarnedMessage = "" })) {
                Button("확인") { jellyEarnedMessage = "" }
            } message: {
                Text(jellyEarnedMessage)
            }
        }
        .task {
            async let tasksLoad: Void = loadTasks()
            async let categoriesLoad: Void = loadCategories()
            async let jellyLoad: Void = jellyStore.refresh()
            _ = await (tasksLoad, categoriesLoad, jellyLoad)
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { await jellyStore.refresh() }
            }
        }
    }

    private var motivationBanner: some View {
        Text("오늘도 포실이와 함께, 천천히 해봐요")
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(CorkBoardTheme.accentBlue)
                    .shadow(color: .black.opacity(0.2), radius: 3, y: 2)
            )
            .padding(.horizontal, 24)
            .rotationEffect(.degrees(-1))
    }

    private func togglePendingComplete(_ task: TaskItem) {
        if pendingCompleteIds.contains(task.id) {
            pendingCompleteIds.remove(task.id)
            completeGeneration[task.id, default: 0] += 1
            return
        }

        pendingCompleteIds.insert(task.id)
        let generation = (completeGeneration[task.id] ?? 0) + 1
        completeGeneration[task.id] = generation

        Task {
            try? await Task.sleep(nanoseconds: Self.completeDelayNanoseconds)
            guard completeGeneration[task.id] == generation,
                  pendingCompleteIds.contains(task.id) else { return }
            await finalizeComplete(task)
        }
    }

    @MainActor
    private func finalizeComplete(_ task: TaskItem) async {
        do {
            let awarded = try await SupabaseService.shared.completeTask(id: task.id)
            pendingCompleteIds.remove(task.id)
            tasks.removeAll { $0.id == task.id }
            if awarded > 0 {
                jellyEarnedMessage = "젤리 +\(awarded)을 획득했어요."
                await jellyStore.refresh()
            }
        } catch {
            pendingCompleteIds.remove(task.id)
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    @MainActor
    private func loadCategories() async {
        do {
            categories = try await SupabaseService.shared.fetchCategories()
        } catch {
            if categories.isEmpty {
                categories = CategoryConstants.localFallbackList()
            }
        }
    }

    private func loadTasks() async {
        isLoading = true
        errorMessage = ""
        do {
            tasks = try await SupabaseService.shared.fetchTodayTasks()
            let ids = Set(tasks.map(\.id))
            pendingCompleteIds = pendingCompleteIds.intersection(ids)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isLoading = false
    }

    private func addTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        do {
            try await SupabaseService.shared.addTask(title: title)
            await loadTasks()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
