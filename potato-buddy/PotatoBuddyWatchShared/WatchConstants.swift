import Foundation

/// 워치 앱 ↔ 워치 위젯(컴플리케이션) 공용 상수
enum WatchConstants {
    /// 워치 앱과 워치 위젯이 함께 쓰는 App Group
    static let appGroupId = "group.com.youngryul.potatobuddy.watch"

    static var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroupId) ?? .standard
    }

    /// 워치 앱 딥링크 (컴플리케이션 탭 → 해당 기능 화면)
    static let urlScheme = "potatobuddywatch"
}

/// 컴플리케이션 → 워치 앱 딥링크 (host 는 WatchFeature 의 rawValue 와 일치해야 함)
enum WatchDeepLink {
    static let todayTasks = URL(string: "\(WatchConstants.urlScheme)://tasks")!
}

/// 위젯 kind — 새 컴플리케이션을 추가하면 여기에 등록
enum WatchWidgetKind {
    static let todayTasks = "WatchTodayTasks"
}
