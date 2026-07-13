import Foundation
import WidgetKit

enum ScheduleWidgetService {
    static func refreshTodayWidget() async {
        let isLoggedIn = await MainActor.run { AuthService.shared.isLoggedIn }
        guard isLoggedIn else {
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
            var schedules = try await SupabaseService.shared.fetchSchedules(year: year, month: month)

            let todaySchedules = schedules.filter { $0.contains(date: today) }
            if !todaySchedules.isEmpty {
                syncWidgetSnapshot(schedules: todaySchedules, dateString: today)
                return
            }

            // 이번 달에 오늘 이후 일정이 없으면 다음 달도 조회
            var upcoming = schedules.filter { $0.scheduleDate > today }
            if upcoming.isEmpty {
                guard let nextMonthDate = calendar.date(byAdding: .month, value: 1, to: calendar.startOfDay(for: now)) else {
                    syncWidgetSnapshot(schedules: [], dateString: today)
                    return
                }
                let nextYear = calendar.component(.year, from: nextMonthDate)
                let nextMonth = calendar.component(.month, from: nextMonthDate)
                let nextMonthSchedules = try await SupabaseService.shared.fetchSchedules(
                    year: nextYear,
                    month: nextMonth
                )
                schedules.append(contentsOf: nextMonthSchedules)
                upcoming = schedules.filter { $0.scheduleDate > today }
            }

            guard let nextDate = upcoming.map(\.scheduleDate).min() else {
                syncWidgetSnapshot(schedules: [], dateString: today)
                return
            }

            let nextSchedules = upcoming.filter { $0.scheduleDate == nextDate }
            syncWidgetSnapshot(schedules: nextSchedules, dateString: nextDate)
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
