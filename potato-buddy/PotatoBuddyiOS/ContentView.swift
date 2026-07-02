import SwiftUI

struct ContentView: View {
    @StateObject private var auth = AuthService.shared
    @State private var isLoggedIn: Bool = AuthService.shared.isLoggedIn

    var body: some View {
        Group {
            if isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .authStateChanged)) { _ in
            isLoggedIn = AuthService.shared.isLoggedIn
        }
        .onChange(of: auth.isLoggedIn) { newValue in
            isLoggedIn = newValue
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
