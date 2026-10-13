import AppIntents
import SwiftUI
import WidgetKit

/// 잠금화면 하단(손전등·카메라 자리)이나 제어 센터에 둘 수 있는 백로그 추가 버튼
/// - 실행 인텐트(OpenBacklogAddIntent)는 Shared/QuickAddBacklogIntent.swift에 있다.
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
