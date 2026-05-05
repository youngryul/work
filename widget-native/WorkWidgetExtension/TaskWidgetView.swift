import SwiftUI
import WidgetKit

// MARK: - 진입점

struct TaskWidgetView: View {
    var entry: TaskEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:  SmallView(entry: entry)
        case .systemMedium: MediumView(entry: entry)
        default:            LargeView(entry: entry)
        }
    }
}

// MARK: - Small: 감자 + 뱃지 (클릭 → 앱의 채팅 UI 열기)

private struct SmallView: View {
    var entry: TaskEntry

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // 감자 + 액세서리 (중앙, 작은 크기, 배경 투명)
            ZStack(alignment: .bottomTrailing) {
                Text("🥔")
                    .font(.system(size: 52))

                if !entry.potatoState.accessory.isEmpty {
                    Text(entry.potatoState.accessory)
                        .font(.system(size: 20))
                        .offset(x: 10, y: 8)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // 오른쪽 상단 뱃지
            badge.padding(8)
        }
        // 클릭 시 WorkWidget 앱(채팅 UI) 열기
        .widgetURL(URL(string: "workwidget://tasks")!)
    }

    @ViewBuilder
    private var badge: some View {
        if entry.tasks.isEmpty {
            ZStack {
                Circle().fill(Color.green).frame(width: 26, height: 26)
                    .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }
        } else {
            ZStack {
                Circle().fill(Color.red).frame(width: 28, height: 28)
                    .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
                Text(entry.tasks.count > 99 ? "99+" : "\(entry.tasks.count)")
                    .font(.system(
                        size: entry.tasks.count > 9 ? 10 : 13,
                        weight: .bold, design: .rounded
                    ))
                    .foregroundColor(.white)
            }
        }
    }
}

// MARK: - Medium

private struct MediumView: View {
    var entry: TaskEntry
    private let maxVisible = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("🥔").font(.title3)
                Text("오늘 할일").font(.subheadline.bold())
                Spacer()
                Text(entry.tasks.isEmpty ? "모두 완료 🎉" : "\(entry.tasks.count)개 남음")
                    .font(.caption).foregroundColor(.secondary)
            }
            .padding(.bottom, 8)

            Divider()

            if entry.tasks.isEmpty {
                Spacer()
                HStack { Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.green).font(.title2)
                        Text("오늘 할일 완료!").font(.callout)
                    }
                    Spacer() }
                Spacer()
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(entry.tasks.prefix(maxVisible)) { task in
                        TaskRow(task: task)
                    }
                    if entry.tasks.count > maxVisible {
                        Text("외 \(entry.tasks.count - maxVisible)개 더...")
                            .font(.caption2).foregroundStyle(.tertiary).padding(.leading, 28)
                    }
                }
                .padding(.top, 6)
                Spacer()
            }

            Divider()
            HStack {
                Spacer()
                Link(destination: Config.websiteURL) {
                    Label("웹사이트 열기", systemImage: "globe")
                        .font(.caption).foregroundStyle(Color.accentColor)
                }
            }
            .padding(.top, 6)
        }
        .padding()
    }
}

// MARK: - Large

private struct LargeView: View {
    var entry: TaskEntry
    private let maxVisible = 8

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("🥔").font(.title2)
                Text("오늘 할일").font(.headline.bold())
                Spacer()
                if !entry.tasks.isEmpty {
                    Text("\(entry.tasks.count)개 남음").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding(.bottom, 10)

            Divider()

            if entry.tasks.isEmpty {
                Spacer()
                HStack { Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.green).font(.largeTitle)
                        Text("오늘 할일 모두 완료! 🎉").font(.title3)
                    }
                    Spacer() }
                Spacer()
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(entry.tasks.prefix(maxVisible)) { task in
                        TaskRow(task: task)
                        if task.id != entry.tasks.prefix(maxVisible).last?.id {
                            Divider().padding(.leading, 28)
                        }
                    }
                    if entry.tasks.count > maxVisible {
                        Text("외 \(entry.tasks.count - maxVisible)개 더...")
                            .font(.caption).foregroundStyle(.tertiary).padding(.leading, 28)
                    }
                }
                .padding(.top, 8)
                Spacer()
            }

            Divider()
            HStack {
                Spacer()
                Link(destination: Config.websiteURL) {
                    Label("웹사이트 열기", systemImage: "globe")
                        .font(.caption).foregroundStyle(Color.accentColor)
                }
            }
            .padding(.top, 8)
        }
        .padding()
    }
}

// MARK: - 할일 행

private struct TaskRow: View {
    let task: TaskItem

    var body: some View {
        HStack(spacing: 8) {
            Button(intent: CompleteTaskIntent(taskId: task.id)) {
                Image(systemName: "circle").foregroundColor(.secondary).font(.body)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title).font(.callout).lineLimit(1)
                if let cat = task.category, cat != "작업", !cat.isEmpty {
                    Text(cat).font(.caption2).foregroundStyle(.tertiary)
                }
            }
            Spacer()
        }
    }
}
