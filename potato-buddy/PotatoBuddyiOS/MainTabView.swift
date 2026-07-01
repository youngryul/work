import SwiftUI

struct MainTabView: View {
    @StateObject private var auth = AuthService.shared
    @State private var showLogoutConfirm = false

    var body: some View {
        TabView {
            TodayView()
                .tabItem {
                    Label("오늘 할일", systemImage: "house.fill")
                }

            BacklogView()
                .tabItem {
                    Label("백로그", systemImage: "tray.fill")
                }

            DiaryListView()
                .tabItem {
                    Label("일기", systemImage: "book.fill")
                }

            SettingsView(showLogoutConfirm: $showLogoutConfirm)
                .tabItem {
                    Label("설정", systemImage: "gearshape.fill")
                }
        }
        .tint(.green)
        .confirmationDialog("로그아웃", isPresented: $showLogoutConfirm) {
            Button("로그아웃", role: .destructive) {
                auth.signOut()
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("정말 로그아웃 하시겠어요?")
        }
    }
}
