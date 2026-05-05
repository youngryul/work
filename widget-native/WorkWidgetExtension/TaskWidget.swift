import WidgetKit
import SwiftUI

@main
struct TaskWidget: Widget {
    let kind = "TaskWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TaskProvider()) { entry in
            TaskWidgetView(entry: entry)
                .containerBackground(Color.clear, for: .widget)
        }
        .configurationDisplayName("오늘 할일")
        .description("오늘의 할일 목록을 표시하고 완료 처리합니다.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}