import SwiftUI

struct TodayView: View {
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
                        Text("오늘 할일이 없어요!")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Text("백로그에서 오늘로 이동하거나\n+ 버튼으로 추가해보세요")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(tasks) { task in
                            HStack(spacing: 12) {
                                // 완료 버튼
                                Button {
                                    Task { await complete(task) }
                                } label: {
                                    Image(systemName: "circle")
                                        .foregroundColor(.green)
                                        .font(.title3)
                                }
                                .buttonStyle(.plain)

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
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("오늘 할일")
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
        }
        .task {
            await loadTasks()
        }
    }

    private func loadTasks() async {
        isLoading = true
        errorMessage = ""
        do {
            tasks = try await SupabaseService.shared.fetchTodayTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func complete(_ task: TaskItem) async {
        do {
            try await SupabaseService.shared.completeTask(id: task.id)
            tasks.removeAll { $0.id == task.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func addTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        do {
            try await SupabaseService.shared.addTask(title: title)
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
