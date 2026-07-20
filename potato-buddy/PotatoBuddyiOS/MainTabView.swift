import SwiftUI

struct MainTabView: View {
    static let scheduleTabTag = 3

    @Binding var selectedTab: Int
    @ObservedObject private var auth = AuthService.shared
    @State private var showLogoutConfirm = false

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tabItem {
                    Label("오늘 할일", systemImage: "house.fill")
                }
                .tag(0)

            BacklogView()
                .tabItem {
                    Label("백로그", systemImage: "tray.fill")
                }
                .tag(1)

            DiaryListView()
                .tabItem {
                    Label("일기", systemImage: "book.fill")
                }
                .tag(2)

            ScheduleCalendarView()
                .tabItem {
                    Label("일정", systemImage: "calendar")
                }
                .tag(Self.scheduleTabTag)

            TimerHubView()
                .tabItem {
                    Label("타이머", systemImage: "timer")
                }
                .tag(4)

            HabitTrackerView()
                .tabItem {
                    Label("습관", systemImage: "chart.bar.fill")
                }
                .tag(5)

            TravelItineraryView()
                .tabItem {
                    Label("여행", systemImage: "airplane")
                }
                .tag(6)

            SummerClockView()
                .tabItem {
                    Label("시계", systemImage: "clock.fill")
                }
                .tag(7)

            SettingsView(showLogoutConfirm: $showLogoutConfirm)
                .tabItem {
                    Label("설정", systemImage: "gearshape.fill")
                }
                .tag(8)
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
