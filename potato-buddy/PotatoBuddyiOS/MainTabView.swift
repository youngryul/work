import SwiftUI

struct MainTabView: View {
    static let scheduleTabTag = 3
    static let stepsTabTag = 11
    static let clockTabTag = 9

    @Binding var selectedTab: Int
    @ObservedObject private var auth = AuthService.shared
    @State private var showLogoutConfirm = false

    var body: some View {
        // 시계는 TabView 밖으로 분리해 가로·아이패드에서도 탭/사이드바 메뉴가 안 보이게 함
        if selectedTab == Self.clockTabTag {
            SummerClockView(onBack: { selectedTab = 0 })
        } else {
            mainTabView
        }
    }

    private var mainTabView: some View {
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

            ReadingView()
                .tabItem {
                    Label("독서", systemImage: "books.vertical.fill")
                }
                .tag(12)
                .navigationBarBackButtonHidden(true)

            ProjectRecordsView()
                .tabItem {
                    Label("프로젝트", systemImage: "folder.fill")
                }
                .tag(13)

            StepCounterView()
                .tabItem {
                    Label("걸음", systemImage: "figure.walk")
                }
                .tag(Self.stepsTabTag)

            TravelItineraryView()
                .tabItem {
                    Label("여행", systemImage: "airplane")
                }
                .tag(6)
                .navigationBarBackButtonHidden(true)

            FridgeInventoryView()
                .tabItem {
                    Label("냉장고", systemImage: "refrigerator.fill")
                }
                .tag(8)

            // 실제 시계 UI는 body에서 전체 화면으로 표시 — 탭만 선택용
            Color.clear
                .tabItem {
                    Label("시계", systemImage: "clock.fill")
                }
                .tag(Self.clockTabTag)

            SettingsView(showLogoutConfirm: $showLogoutConfirm)
                .tabItem {
                    Label("설정", systemImage: "gearshape.fill")
                }
                .tag(10)
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
