import UserNotifications
import Foundation

/// 앱 로컬 알림 관리
/// - 걷기 젤리: 매일 오후 8시 (반복)
/// - 오늘 할일: 매일 오후 12시·7시 (당일 동적 내용, 이후 7일 정적 내용)
/// - 일기: 매일 오후 10시 (오늘 일기를 이미 썼으면 오늘 알림은 건너뜀, 7일치)
/// 전체 알림(enabledKey)이 켜져 있을 때 항목별 설정을 따로 적용한다
@MainActor
final class NotificationService {
    static let shared = NotificationService()
    private init() {}

    private let center = UNUserNotificationCenter.current()
    static let enabledKey = "potato-notifications-enabled"
    // 항목별 알림 설정 (기본값: 켜짐)
    static let walkEnabledKey = "potato-notifications-walk-enabled"
    static let todoEnabledKey = "potato-notifications-todo-enabled"
    static let diaryEnabledKey = "potato-notifications-diary-enabled"

    /// 저장된 값이 없으면 켜짐으로 본다
    static func isEnabled(_ key: String) -> Bool {
        UserDefaults.standard.object(forKey: key) as? Bool ?? true
    }

    // MARK: - 권한

    func requestPermission() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    // MARK: - 앱 활성화 시 새로고침

    func refreshIfEnabled() async {
        guard UserDefaults.standard.bool(forKey: Self.enabledKey) else { return }
        let status = await authorizationStatus()
        guard status == .authorized || status == .provisional else { return }

        let walkOn = Self.isEnabled(Self.walkEnabledKey)
        let todoOn = Self.isEnabled(Self.todoEnabledKey)
        let diaryOn = Self.isEnabled(Self.diaryEnabledKey)

        var todoCount: Int?
        if todoOn {
            todoCount = try? await SupabaseService.shared.fetchTodayTasks().count
        }

        // 조회에 실패하면 안 쓴 것으로 보고 오늘 알림도 예약한다
        var hasTodayDiary = false
        if diaryOn {
            hasTodayDiary = (try? await SupabaseService.shared.fetchDiary(date: formatDateKey(Date()))) != nil
        }

        center.removeAllPendingNotificationRequests()
        if walkOn { scheduleWalkJelly() }
        if todoOn { scheduleTodoNotifications(todoCount: todoCount) }
        if diaryOn { scheduleDiaryNotifications(skipToday: hasTodayDiary) }
    }

    // MARK: - 취소

    func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }

    // MARK: - 걷기 젤리 (매일 20:00, 반복)

    private func scheduleWalkJelly() {
        let content = UNMutableNotificationContent()
        content.title = "🍬 젤리 챙기기"
        content.body = "오늘 걷기 젤리를 아직 받지 않으셨나요? 잊지 말고 챙겨가세요!"
        content.sound = .default

        var dc = DateComponents()
        dc.hour = 20
        dc.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
        center.add(UNNotificationRequest(
            identifier: "potato-walk-jelly",
            content: content,
            trigger: trigger
        ))
    }

    // MARK: - 오늘 할일 (12:00 · 19:00, 7일치)

    private func scheduleTodoNotifications(todoCount: Int?) {
        let now = Date()
        let calendar = Calendar.current

        for daysAhead in 0..<7 {
            guard let baseDate = calendar.date(byAdding: .day, value: daysAhead, to: now) else { continue }
            let dayKey = formatDateKey(baseDate)
            let ymd = calendar.dateComponents([.year, .month, .day], from: baseDate)

            let slots: [(hour: Int, idSuffix: String)] = [
                (12, "noon"),
                (19, "evening"),
            ]
            for slot in slots {
                var dc = ymd
                dc.hour = slot.hour
                dc.minute = 0
                guard let fireDate = calendar.date(from: dc), fireDate > now else { continue }

                let content = daysAhead == 0
                    ? makeTodayContent(count: todoCount)
                    : makeGenericContent()
                let trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
                center.add(UNNotificationRequest(
                    identifier: "potato-todo-\(slot.idSuffix)-\(dayKey)",
                    content: content,
                    trigger: trigger
                ))
            }
        }
    }

    // MARK: - 일기 (22:00, 7일치)

    private func scheduleDiaryNotifications(skipToday: Bool) {
        let now = Date()
        let calendar = Calendar.current

        for daysAhead in 0..<7 {
            if daysAhead == 0 && skipToday { continue }
            guard let baseDate = calendar.date(byAdding: .day, value: daysAhead, to: now) else { continue }
            var dc = calendar.dateComponents([.year, .month, .day], from: baseDate)
            dc.hour = 22
            dc.minute = 0
            guard let fireDate = calendar.date(from: dc), fireDate > now else { continue }

            let content = UNMutableNotificationContent()
            content.title = "📔 오늘 일기 쓰기"
            content.body = "오늘 하루는 어땠나요? 잠들기 전에 일기를 남겨보세요!"
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: dc, repeats: false)
            center.add(UNNotificationRequest(
                identifier: "potato-diary-\(formatDateKey(baseDate))",
                content: content,
                trigger: trigger
            ))
        }
    }

    /// 오늘 할일 알림 내용 (동적)
    private func makeTodayContent(count: Int?) -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.sound = .default
        if let count = count, count > 0 {
            c.title = "📋 할 일 \(count)개 남음"
            c.body = "오늘 완료해야 할 할 일이 \(count)개 남아있어요!"
        } else {
            c.title = "📝 오늘 할 일 등록"
            c.body = "오늘 할 일을 아직 등록하지 않으셨어요! 지금 추가해보세요."
        }
        return c
    }

    /// 미래 날짜 정적 알림 내용
    private func makeGenericContent() -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.title = "📋 오늘 할 일 확인"
        c.body = "오늘 할 일을 확인해보세요!"
        c.sound = .default
        return c
    }

    private func formatDateKey(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.string(from: date)
    }
}
