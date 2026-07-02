import Foundation
import WidgetKit

enum ScheduleWidgetService {
    static func refreshTodayWidget() async {
        guard AuthService.shared.isLoggedIn else {
            WidgetScheduleStore.clear()
            reloadWidgetTimelines()
            return
        }

        let today = ScheduleDateHelper.todayString()
        let calendar = Calendar.current
        let now = Date()
        let year = calendar.component(.year, from: now)
        let month = calendar.component(.month, from: now)

        do {
            let schedules = try await SupabaseService.shared.fetchSchedules(year: year, month: month)
            let todaySchedules = schedules.filter { $0.contains(date: today) }
            syncWidgetSnapshot(schedules: todaySchedules, dateString: today)
        } catch {
            // 기존 위젯 데이터 유지
        }
    }

    static func syncWidgetSnapshot(schedules: [ScheduleItem], dateString: String) {
        let snapshot = WidgetScheduleSnapshot(
            dateString: dateString,
            dateLabel: WidgetScheduleDateFormatter.label(for: dateString),
            items: schedules.map {
                WidgetScheduleEntryItem(id: $0.id, title: $0.title, tag: $0.tag)
            },
            updatedAt: Date()
        )
        WidgetScheduleStore.save(snapshot)
        reloadWidgetTimelines()
    }

    private static func reloadWidgetTimelines() {
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetScheduleConstants.widgetKind)
    }
}
