import SwiftUI

/// 워치 홈 메뉴에 노출되는 기능 목록
/// 새 워치 기능을 추가할 때:
/// 1. case 추가 → title / systemImage / destination 채우기
/// 2. 화면은 Features/<기능명>/ 폴더에, API 는 PotatoBuddyWatchShared/ 에 작성
/// 3. 컴플리케이션이 필요하면 PotatoBuddyWatchWidget/ 에 위젯을 만들고 번들에 등록
enum WatchFeature: String, CaseIterable, Identifiable, Hashable {
    case todayTasks = "tasks"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .todayTasks: return "오늘 할일"
        }
    }

    var systemImage: String {
        switch self {
        case .todayTasks: return "checklist"
        }
    }

    var tint: Color {
        switch self {
        case .todayTasks: return .orange
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .todayTasks: TodayTasksView()
        }
    }

    /// potatobuddywatch://tasks → .todayTasks
    init?(url: URL) {
        guard url.scheme == WatchConstants.urlScheme, let host = url.host else { return nil }
        self.init(rawValue: host)
    }
}
