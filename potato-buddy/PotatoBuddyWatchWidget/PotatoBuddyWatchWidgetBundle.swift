import SwiftUI
import WidgetKit

/// 워치 컴플리케이션 모음 — 새 컴플리케이션은 여기에 추가
@main
struct PotatoBuddyWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayTasksComplication()
    }
}
