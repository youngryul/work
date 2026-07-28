import SwiftUI

/// 타이머 / 뽀모도로를 하나의 탭으로 묶는 허브
struct TimerHubView: View {
    @State private var selectedPage: Page = .stopwatch

    enum Page: String, CaseIterable {
        case stopwatch  = "타이머"
        case pomodoro   = "뽀모도로"
        case stats      = "통계"

        var icon: String {
            switch self {
            case .stopwatch: return "stopwatch"
            case .pomodoro:  return "timer"
            case .stats:     return "chart.bar"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
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

            switch selectedPage {
            case .stopwatch: StudyTimerView()
            case .pomodoro:  PomodoroView()
            case .stats:     StudyTimeView()
            }
        }
        .navigationBarHidden(true)
    }
}
