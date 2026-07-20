import SwiftUI

/// 뽀모도로 / 공부 타이머 / 통계를 하나의 탭으로 묶는 허브
struct TimerHubView: View {
    @State private var selectedPage: Page = .pomodoro

    enum Page: String, CaseIterable {
        case pomodoro   = "뽀모도로"
        case stopwatch  = "공부 타이머"
        case stats      = "통계"

        var icon: String {
            switch self {
            case .pomodoro:  return "timer"
            case .stopwatch: return "stopwatch"
            case .stats:     return "chart.bar"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // 상단 세그먼트 피커
            Picker("", selection: $selectedPage) {
                ForEach(Page.allCases, id: \.self) { page in
                    Text(page.rawValue).tag(page)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(.systemGroupedBackground))

            Divider()

            // 페이지 콘텐츠
            switch selectedPage {
            case .pomodoro:  PomodoroView()
            case .stopwatch: StudyTimerView()
            case .stats:     StudyTimeView()
            }
        }
        .navigationBarHidden(true)
    }
}
