import SwiftUI

struct BacklogView: View {
    @State private var tasks: [TaskItem] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""
    @State private var showAddAlert: Bool = false
    @State private var newTaskTitle: String = ""

    var body: some View {
        NavigationView {
            Group {
                if isLoading {
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

                                // 오늘로 이동 버튼
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
                        showAddAlert = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .refreshable {
                await loadTasks()
            }
            .alert("백로그 추가", isPresented: $showAddAlert) {
                TextField("할일 제목", text: $newTaskTitle)
                Button("추가") {
                    if !newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty {
                        Task { await addBacklogTask() }
                    }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("백로그에 추가됩니다")
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
        do {
            try await SupabaseService.shared.addBacklogTask(title: title, category: "작업")
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
