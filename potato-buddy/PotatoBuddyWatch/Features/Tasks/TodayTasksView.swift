import SwiftUI

struct TodayTasksView: View {
    @StateObject private var viewModel = TodayTasksViewModel()

    var body: some View {
        List {
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.caption2)
                    .foregroundStyle(.red)
                    .listRowBackground(Color.clear)
            }

            if viewModel.tasks.isEmpty {
                emptyState
            } else {
                ForEach(viewModel.tasks) { task in
                    TaskRow(
                        task: task,
                        isCompleting: viewModel.completingIds.contains(task.id)
                    ) {
                        Task { await viewModel.complete(task) }
                    }
                }
            }

            if let updatedAt = viewModel.updatedAt {
                Text("\(updatedAt, format: .dateTime.hour().minute()) 업데이트")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("오늘 할일 \(viewModel.tasks.count)")
        .overlay {
            if viewModel.isLoading && viewModel.tasks.isEmpty {
                ProgressView()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .task {
            await viewModel.refresh()
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        if !viewModel.isLoading {
            VStack(spacing: 6) {
                Text("🥔")
                    .font(.title)
                Text("오늘 할일을 모두 끝냈어요!")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
    }
}

private struct TaskRow: View {
    let task: TaskItem
    let isCompleting: Bool
    let onComplete: () -> Void

    var body: some View {
        Button(action: onComplete) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: isCompleting ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isCompleting ? .green : .orange)
                    .imageScale(.large)
                Text(task.displayTitle)
                    .font(.footnote)
                    .lineLimit(3)
                    .strikethrough(isCompleting)
                    .foregroundStyle(isCompleting ? .secondary : .primary)
            }
        }
        .disabled(isCompleting)
    }
}
