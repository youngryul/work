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
                    await jellyStore.refresh()
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active, auth.isLoggedIn else { return }
            Task {
                await ScheduleWidgetService.refreshTodayWidget()
                await jellyStore.refresh()
            }
        }
        .task {
            if auth.isLoggedIn {
                await ScheduleWidgetService.refreshTodayWidget()
                await jellyStore.refresh()
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "potatobuddy", auth.isLoggedIn else { return }

        switch url.host {
        case "schedule":
            selectedTab = MainTabView.scheduleTabTag
        default:
            break
        }
    }
}
