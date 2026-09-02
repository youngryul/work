import Foundation
import WidgetKit

enum ScheduleWidgetService {
    static func refreshTodayWidget() async {
        let isLoggedIn = await MainActor.run { AuthService.shared.isLoggedIn }
        guard isLoggedIn else {
            WidgetScheduleStore.clearAll()
            reloadWidgetTimelines()
            return
        }

        let today = ScheduleDateHelper.todayString()
        let tomorrow = ScheduleDateHelper.addDays(today, 1) ?? today
        let calendar = Calendar.current
        let now = Date()
        let year = calendar.component(.year, from: now)
        let month = calendar.component(.month, from: now)

        do {
            // 이번 달 일정 조회
            var schedules = try await SupabaseService.shared.fetchSchedules(year: year, month: month)

            // 내일이 다음 달이면 다음 달도 함께 조회
            let tomorrowDate = calendar.date(byAdding: .day, value: 1, to: now) ?? now
            let tomorrowMonth = calendar.component(.month, from: tomorrowDate)
            let tomorrowYear = calendar.component(.year, from: tomorrowDate)
            if tomorrowMonth != month {
                let nextMonthSchedules = try await SupabaseService.shared.fetchSchedules(
                    year: tomorrowYear, month: tomorrowMonth
                )
                schedules.append(contentsOf: nextMonthSchedules)
            }

            // ── 오늘 스냅샷 ──
            let todaySchedules = schedules.filter { $0.contains(date: today) }
            if !todaySchedules.isEmpty {
                save(schedules: todaySchedules, forDate: today)
            } else {
                // 오늘 일정 없으면 다가오는 일정을 오늘 스냅샷으로 저장
                var upcoming = schedules.filter { $0.scheduleDate > today }
                if upcoming.isEmpty {
                    guard let nextMonthDate = calendar.date(
                        byAdding: .month, value: 1, to: calendar.startOfDay(for: now)
                    ) else {
                        save(schedules: [], forDate: today)
                        return
                    }
                    let nextYear = calendar.component(.year, from: nextMonthDate)
                    let nextMonth = calendar.component(.month, from: nextMonthDate)
                    let nextMonthSchedules = try await SupabaseService.shared.fetchSchedules(
                        year: nextYear, month: nextMonth
                    )
                    schedules.append(contentsOf: nextMonthSchedules)
                    upcoming = schedules.filter { $0.scheduleDate > today }
                }

                if let nextDate = upcoming.map(\.scheduleDate).min() {
                    let nextSchedules = upcoming.filter { $0.scheduleDate == nextDate }
                    save(schedules: nextSchedules, forDate: nextDate)
                    // 오늘 키에도 "다가오는 일정" 스냅샷 저장 (위젯에서 날짜 불일치로 upcoming 표시됨)
                    WidgetScheduleStore.save(
                        makeSnapshot(schedules: nextSchedules, dateString: nextDate),
                        forDate: today
                    )
                } else {
                    save(schedules: [], forDate: today)
                }
            }

            // ── 내일 스냅샷 ──
            let tomorrowSchedules = schedules.filter { $0.contains(date: tomorrow) }
            save(schedules: tomorrowSchedules, forDate: tomorrow)

            reloadWidgetTimelines()
        } catch {
            // 기존 위젯 데이터 유지
        }
    }

    // 레거시 호환용 (syncWidgetSnapshot 대신 내부 save 사용)
    static func syncWidgetSnapshot(schedules: [ScheduleItem], dateString: String) {
        let snapshot = makeSnapshot(schedules: schedules, dateString: dateString)
        WidgetScheduleStore.save(snapshot, forDate: dateString)
        WidgetScheduleStore.save(snapshot)  // 레거시 단일 키에도 저장
        reloadWidgetTimelines()
    }

    private static func save(schedules: [ScheduleItem], forDate dateString: String) {
        let snapshot = makeSnapshot(schedules: schedules, dateString: dateString)
        WidgetScheduleStore.save(snapshot, forDate: dateString)
        // 오늘 날짜면 레거시 단일 키에도 저장 (하위 호환)
        if dateString == ScheduleDateHelper.todayString() {
            WidgetScheduleStore.save(snapshot)
        }
    }

    private static func makeSnapshot(schedules: [ScheduleItem], dateString: String) -> WidgetScheduleSnapshot {
        WidgetScheduleSnapshot(
            dateString: dateString,
            dateLabel: WidgetScheduleDateFormatter.label(for: dateString),
            items: schedules.map {
                WidgetScheduleEntryItem(id: $0.id, title: $0.title, tag: $0.tag)
            },
            updatedAt: Date()
        )
    }

    private static func reloadWidgetTimelines() {
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetScheduleConstants.widgetKind)
    }
}
