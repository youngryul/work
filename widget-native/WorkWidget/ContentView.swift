import SwiftUI
import WidgetKit

// MARK: - 말풍선 꼬리가 아래를 향하는 커스텀 Shape

struct DownwardBubbleShape: Shape {
    var cornerRadius: CGFloat = 18
    var tailHeight: CGFloat  = 14
    var tailWidth: CGFloat   = 20

    func path(in rect: CGRect) -> Path {
        let body   = CGRect(x: 0, y: 0, width: rect.width, height: rect.height - tailHeight)
        let cx     = rect.midX
        var p      = Path()

        p.move(to: CGPoint(x: cornerRadius, y: 0))
        // 상단
        p.addLine(to: CGPoint(x: body.maxX - cornerRadius, y: 0))
        p.addArc(tangent1End: CGPoint(x: body.maxX, y: 0),
                 tangent2End: CGPoint(x: body.maxX, y: cornerRadius), radius: cornerRadius)
        // 우측
        p.addLine(to: CGPoint(x: body.maxX, y: body.maxY - cornerRadius))
        p.addArc(tangent1End: CGPoint(x: body.maxX, y: body.maxY),
                 tangent2End: CGPoint(x: body.maxX - cornerRadius, y: body.maxY), radius: cornerRadius)
        // 하단 → 꼬리 → 하단
        p.addLine(to: CGPoint(x: cx + tailWidth / 2, y: body.maxY))
        p.addLine(to: CGPoint(x: cx, y: rect.maxY))          // 꼬리 끝 (감자 방향)
        p.addLine(to: CGPoint(x: cx - tailWidth / 2, y: body.maxY))
        p.addLine(to: CGPoint(x: cornerRadius, y: body.maxY))
        p.addArc(tangent1End: CGPoint(x: 0, y: body.maxY),
                 tangent2End: CGPoint(x: 0, y: body.maxY - cornerRadius), radius: cornerRadius)
        // 좌측
        p.addLine(to: CGPoint(x: 0, y: cornerRadius))
        p.addArc(tangent1End: CGPoint(x: 0, y: 0),
                 tangent2End: CGPoint(x: cornerRadius, y: 0), radius: cornerRadius)
        p.closeSubpath()
        return p
    }
}

// MARK: - ContentView

struct ContentView: View {
    @State private var tasks: [TaskItem] = []
    @State private var isLoading = true
    @State private var completingIds: Set<String> = []
    @State private var newTaskTitle = ""
    @State private var isAdding = false

    private let tailH: CGFloat = 14

    var body: some View {
        VStack(spacing: 0) {
            // ── 말풍선 영역 (상단) ──────────────────────────────
            bubbleArea
                .padding(.horizontal, 12)
                .padding(.top, 12)
                .layoutPriority(1)

            // ── 감자 캐릭터 (하단, 말풍선 꼬리 바로 아래) ──────
            Text("🥔")
                .font(.system(size: 62))
                .frame(maxWidth: .infinity)
                .padding(.top, -2)
                .padding(.bottom, 6)

            Divider()

            // ── 입력 영역 ───────────────────────────────────────
            inputArea
        }
        .frame(width: 300, height: 470)
        .background(Color(nsColor: .controlBackgroundColor))
        .task { await loadTasks() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            Task { await loadTasks() }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task { await loadTasks() }
        }
    }

    // MARK: - 말풍선 전체 영역

    private var bubbleArea: some View {
        VStack(spacing: 0) {
            // 헤더
            HStack {
                Text(isLoading ? "불러오는 중..." :
                     tasks.isEmpty ? "오늘 할일 완료! 🎉" : "안녕! 오늘 할일이야 👋")
                    .font(.subheadline.bold())
                Spacer()
                if !isLoading && !tasks.isEmpty {
                    Text("\(tasks.count)개 남음")
                        .font(.caption).foregroundColor(.secondary)
                }
                Button { Task { await loadTasks() } } label: {
                    Image(systemName: "arrow.clockwise").font(.caption)
                }
                .buttonStyle(.plain).disabled(isLoading).padding(.leading, 6)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            Divider()

            // 할일 목록
            taskListArea
        }
        // 꼬리 공간만큼 하단 패딩 → 내용이 꼬리와 겹치지 않음
        .padding(.bottom, tailH)
        .background(
            DownwardBubbleShape(tailHeight: tailH)
                .fill(Color(nsColor: .windowBackgroundColor))
                .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 3)
        )
    }

    // MARK: - 할일 목록

    @ViewBuilder
    private var taskListArea: some View {
        if isLoading {
            Spacer()
            ProgressView().padding()
            Spacer()
        } else if tasks.isEmpty {
            Spacer()
            VStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.green).font(.system(size: 36))
                Text("모두 완료! 수고했어 🎉").font(.callout)
            }
            .frame(maxWidth: .infinity)
            Spacer()
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(tasks) { task in
                            taskRow(task).id(task.id)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                }
                .onChange(of: tasks.count) { _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
            }
        }
    }

    // MARK: - 할일 행

    private func taskRow(_ task: TaskItem) -> some View {
        let completing = completingIds.contains(task.id)
        return HStack(spacing: 10) {
            Button {
                Task { await completeTask(task) }
            } label: {
                Image(systemName: completing ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(completing ? Color.green : Color.secondary)
                    .font(.body)
                    .animation(.easeInOut(duration: 0.15), value: completing)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.callout)
                    .strikethrough(completing, color: Color.secondary)
                    .foregroundColor(completing ? .secondary : .primary)
                    .lineLimit(2)
                if let cat = task.category, cat != "작업", !cat.isEmpty {
                    Text(cat).font(.caption2).foregroundStyle(.tertiary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 3)
        .opacity(completing ? 0.5 : 1)
    }

    // MARK: - 입력 영역

    private var inputArea: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                TextField("새 할일 추가...", text: $newTaskTitle)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await addTask() } }

                Button { Task { await addTask() } } label: {
                    Image(systemName: isAdding ? "ellipsis.circle" : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(newTaskTitle.isEmpty || isAdding
                                         ? Color.secondary : Color.accentColor)
                }
                .buttonStyle(.plain)
                .disabled(newTaskTitle.isEmpty || isAdding)
            }
            .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 6)

            Link(destination: Config.websiteURL) {
                Label("웹사이트 열기", systemImage: "globe")
                    .font(.caption)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 10)
            }
            .foregroundStyle(Color.accentColor)
        }
    }

    // MARK: -

    private func loadTasks() async {
        isLoading = true
        tasks = (try? await SupabaseService.shared.fetchTodayTasks()) ?? []
        isLoading = false
    }

    @MainActor
    private func completeTask(_ task: TaskItem) async {
        completingIds.insert(task.id)
        try? await SupabaseService.shared.completeTask(id: task.id)
        tasks.removeAll { $0.id == task.id }
        completingIds.remove(task.id)
        WidgetCenter.shared.reloadAllTimelines()
    }

    @MainActor
    private func addTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        isAdding = true
        newTaskTitle = ""
        do {
            try await SupabaseService.shared.addTask(title: title)
            await loadTasks()
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            newTaskTitle = title
        }
        isAdding = false
    }
}
