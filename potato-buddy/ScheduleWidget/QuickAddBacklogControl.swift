import AppIntents
import SwiftUI
import WidgetKit

/// 앱의 백로그 추가 화면 딥링크
private let quickAddBacklogURL = URL(string: "potatobuddy://backlog/add")!

/// 잠금화면/제어 센터 버튼에서 실행: 앱을 열어 백로그 추가 화면을 띄운다.
/// 앱을 여는 동작이라 잠금 상태에서는 Face ID로 잠금 해제 후 열린다.
@available(iOS 18.0, *)
struct OpenBacklogAddIntent: AppIntent {
    static let title: LocalizedStringResource = "백로그에 할일 추가"
    static let description = IntentDescription("포실이 앱의 백로그 추가 화면을 엽니다.")

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(quickAddBacklogURL))
    }
}

/// 잠금화면 하단(손전등·카메라 자리)이나 제어 센터에 둘 수 있는 백로그 추가 버튼
@available(iOS 18.0, *)
struct QuickAddBacklogControl: ControlWidget {
    static let kind = "com.youngryul.potatobuddy.ios.quickAddBacklog"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenBacklogAddIntent()) {
                Label("백로그 추가", systemImage: "square.and.pencil")
            }
        }
        .displayName("백로그 할일 추가")
        .description("포실이 백로그 추가 화면을 바로 엽니다.")
    }
}
