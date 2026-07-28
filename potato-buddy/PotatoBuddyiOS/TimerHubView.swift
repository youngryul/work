import SwiftUI

/// 뽀모도로 / 공부 타이머를 하나의 탭으로 묶는 허브
struct TimerHubView: View {
    @State private var selectedPage: Page = .pomodoro

    enum Page: String, CaseIterable {
        case pomodoro   = "뽀모도로"
        case stopwatch  = "타이머"

        var icon: String {
            switch self {
            case .pomodoro:  return "timer"
            case .stopwatch: return "stopwatch"
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
            case .pomodoro:  PomodoroView()
            case .stopwatch: StudyTimerView()
            }
        }
        .navigationBarHidden(true)
    }
}
