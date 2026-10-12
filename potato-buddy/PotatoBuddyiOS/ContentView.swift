import SwiftUI

struct ContentView: View {
    @ObservedObject private var auth = AuthService.shared
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var jellyStore = JellyBalanceStore.shared
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if auth.isLoggedIn {
                MainTabView(selectedTab: $selectedTab)
                    .environmentObject(jellyStore)
            } else {
                LoginView()
            }
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
        .onChange(of: auth.isLoggedIn) { _, newValue in
            if newValue {
                Task {
                    await ScheduleWidgetService.refreshTodayWidget()
                    await WeatherWidgetService.shared.refreshWeatherWidget()
                    await jellyStore.refresh()
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active, auth.isLoggedIn else { return }
            Task {
                await ScheduleWidgetService.refreshTodayWidget()
                await WeatherWidgetService.shared.refreshWeatherWidget()
                await jellyStore.refresh()
                await NotificationService.shared.refreshIfEnabled()
            }
        }
        .task {
            if auth.isLoggedIn {
                await ScheduleWidgetService.refreshTodayWidget()
                await WeatherWidgetService.shared.refreshWeatherWidget()
                await jellyStore.refresh()
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "potatobuddy", auth.isLoggedIn else { return }

        switch url.host {
        case "schedule":
            selectedTab = MainTabView.scheduleTabTag
        case "backlog":
            selectedTab = MainTabView.backlogTabTag
            // potatobuddy://backlog/add → 백로그 추가 화면 열기 (잠금화면 버튼)
            if url.path == "/add" {
                QuickAddRouter.shared.backlogAddRequested = true
            }
        default:
            break
        }
    }
}

/// 딥링크로 들어온 "추가 화면 열기" 요청 전달
/// - 탭 전환 직후 BacklogView가 아직 만들어지지 않았을 수 있어, 요청을 보관했다가 화면이 나타날 때 처리한다.
@MainActor
final class QuickAddRouter: ObservableObject {
    static let shared = QuickAddRouter()
    private init() {}

    @Published var backlogAddRequested = false
}
