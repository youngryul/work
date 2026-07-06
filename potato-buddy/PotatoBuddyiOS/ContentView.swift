import SwiftUI

struct ContentView: View {
    @ObservedObject private var auth = AuthService.shared

    var body: some View {
        Group {
            if auth.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .onChange(of: auth.isLoggedIn) { _, newValue in
            if newValue {
                Task { await ScheduleWidgetService.refreshTodayWidget() }
            }
        }
        .task {
            if auth.isLoggedIn {
                await ScheduleWidgetService.refreshTodayWidget()
            }
        }
    }
}
