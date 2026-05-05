import SwiftUI

/// 감자 위에 뜨는 채팅 말풍선 뷰
struct ChatBubbleView: View {
    @EnvironmentObject var viewModel: TodoViewModel

    private let tailH: CGFloat = 14

    var body: some View {
        VStack(spacing: 0) {
            // 헤더
            HStack {
                Text(viewModel.isLoading ? "불러오는 중..." :
                     viewModel.tasks.isEmpty ? "오늘 할일 완료! 🎉" : "안녕! 오늘 할일이야 👋")
                    .font(.subheadline.bold())
                Spacer()
                if !viewModel.isLoading && !viewModel.tasks.isEmpty {
                    Text("\(viewModel.tasks.count)개 남음")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Button {
                    Task { await viewModel.fetchTasks() }
                } label: {
                    Image(systemName: "arrow.clockwise").font(.caption)
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isLoading)
                .padding(.leading, 6)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            Divider()

            // 할일 목록
            taskListArea

            Divider()

            // 입력 영역
            inputArea
        }
        .frame(width: 260)
        .padding(.bottom, tailH)
        .background(
            DownwardBubbleShape(tailHeight: tailH, tailAnchor: 0.75)
                .fill(Color(nsColor: .windowBackgroundColor))
                .shadow(color: .black.opacity(0.15), radius: 10, x: 0, y: 4)
        )
    }

    // MARK: - 할일 목록

    @ViewBuilder
    private var taskListArea: some View {
        if viewModel.isLoading {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
        } else if viewModel.tasks.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.green)
                    .font(.system(size: 32))
                Text("모두 완료! 수고했어 🎉").font(.callout)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(viewModel.tasks) { task in
                            taskRow(task).id(task.id)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                }
                .frame(maxHeight: 260)
                .onChange(of: viewModel.tasks.count) { _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
            }
        }
    }

    // MARK: - 할일 행

    private func taskRow(_ task: TaskItem) -> some View {
        let completing = viewModel.completingIds.contains(task.id)
        return HStack(spacing: 10) {
            Button {
                Task { await viewModel.completeTask(task) }
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
                    Text(cat)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
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
                TextField("새 할일 추가...", text: $viewModel.newTaskTitle)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await viewModel.addTask() } }

                Button {
                    Task { await viewModel.addTask() }
                } label: {
                    Image(systemName: viewModel.isAdding ? "ellipsis.circle" : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(
                            viewModel.newTaskTitle.isEmpty || viewModel.isAdding
                                ? Color.secondary : Color.accentColor
                        )
                }
                .buttonStyle(.plain)
                .disabled(viewModel.newTaskTitle.isEmpty || viewModel.isAdding)
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
            .padding(.bottom, 6)

            Link(destination: Config.websiteURL) {
                Label("웹사이트 열기", systemImage: "globe")
                    .font(.caption)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 10)
            }
            .foregroundStyle(Color.accentColor)
        }
    }
}
