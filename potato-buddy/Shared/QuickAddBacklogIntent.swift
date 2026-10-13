#if os(iOS)
import AppIntents
import Foundation

/// 잠금화면/제어 센터 버튼에서 들어온 "백로그 추가" 요청 전달
/// - 인텐트가 위젯 확장·앱 어느 쪽에서 실행되더라도 앱이 받을 수 있도록 App Group에 표시해 둔다.
enum QuickAddBacklogRequest {
    private static let flagKey = "quickAddBacklogRequested"
    static let notification = Notification.Name("QuickAddBacklogRequested")

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: WidgetScheduleConstants.appGroupId)
    }

    static func mark() {
        defaults?.set(true, forKey: flagKey)
        NotificationCenter.default.post(name: notification, object: nil)
    }

    /// 대기 중인 요청이 있으면 지우고 true 반환
    static func consume() -> Bool {
        guard let defaults, defaults.bool(forKey: flagKey) else { return false }
        defaults.removeObject(forKey: flagKey)
        return true
    }
}

/// 잠금화면/제어 센터 버튼에서 실행: 앱을 열어 백로그 추가 화면을 띄운다.
/// - 앱 타깃과 위젯 확장 타깃 양쪽에 포함되어야 openAppWhenRun으로 앱이 열린다.
/// - 잠금 상태에서는 Face ID로 잠금 해제 후 열린다.
@available(iOS 18.0, *)
struct OpenBacklogAddIntent: AppIntent {
    static let title: LocalizedStringResource = "백로그에 할일 추가"
    static let description = IntentDescription("포실이 앱의 백로그 추가 화면을 엽니다.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        QuickAddBacklogRequest.mark()
        return .result()
    }
}
#endif
