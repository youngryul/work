import SwiftUI

struct MainTabView: View {
    static let backlogTabTag = 1
    static let scheduleTabTag = 3
    static let stepsTabTag = 11
    static let clockTabTag = 9
    static let moreTabTag = 14
    static let farmTabTag = 16
    static let graduateNotesTabTag = 17
    static let ddayTabTag = 18
    static let travelAlbumTabTag = 19
    static let notebooksTabTag = 20

    /// 예전 토익 탭 tag. 커스텀 더보기에도 넣지 않는다.
    private static let removedToeicTabTag = 7

    private static let primaryTabTags: Set<Int> = [0, backlogTabTag, 2, scheduleTabTag, moreTabTag]

    @Binding var selectedTab: Int
    @ObservedObject private var auth = AuthService.shared
    @State private var showLogoutConfirm = false
    /// 탭 이동 시 초기화되지 않도록 MainTabView에서 소유
    @StateObject private var timerViewModel = StudyTimerViewModel()
    /// '1년 전 오늘' 카드 등에서 일기를 열어 달라는 요청
    @ObservedObject private var diaryOpenRequest = DiaryOpenRequest.shared

    /// 하단 탭은 5개만 두어 iOS 시스템 More가 생기지 않게 한다.
    private var tabBarSelection: Binding<Int> {
        Binding(
            get: {
                Self.primaryTabTags.contains(selectedTab) ? selectedTab : Self.moreTabTag
            },
            set: { newValue in
                selectedTab = newValue
            }
        )
    }

    var body: some View {
        // 시계는 TabView 밖으로 분리해 가로·아이패드에서도 탭/사이드바 메뉴가 안 보이게 함
        if selectedTab == Self.clockTabTag {
            SummerClockView(onBack: { selectedTab = Self.moreTabTag })
        } else {
            mainTabView
        }
    }

    private var mainTabView: some View {
        TabView(selection: tabBarSelection) {
            TodayView()
                .tabItem {
                    Label("오늘 할일", systemImage: "house.fill")
                }
                .tag(0)

            BacklogView()
                .tabItem {
                    Label("백로그", systemImage: "tray.fill")
                }
                .tag(Self.backlogTabTag)

            DiaryCalendarView()
                .tabItem {
                    Label("일기", systemImage: "book.fill")
                }
                .tag(2)

            ScheduleCalendarView()
                .tabItem {
                    Label("일정", systemImage: "calendar")
                }
                .tag(Self.scheduleTabTag)

            moreTabRoot
                .tabItem {
                    Label("더보기", systemImage: "ellipsis.circle.fill")
                }
                .tag(Self.moreTabTag)
        }
        .tint(.green)
        .onAppear {
            if selectedTab == Self.removedToeicTabTag {
                selectedTab = Self.moreTabTag
            }
        }
        .onChange(of: diaryOpenRequest.pendingDate) { _, newValue in
            // 일기 탭으로 이동 (실제 열기는 DiaryCalendarView가 처리)
            if newValue != nil { selectedTab = 2 }
        }
        .confirmationDialog("로그아웃", isPresented: $showLogoutConfirm) {
            Button("로그아웃", role: .destructive) {
                auth.signOut()
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("정말 로그아웃 하시겠어요?")
        }
    }

    @ViewBuilder
    private var moreTabRoot: some View {
        switch selectedTab {
        case 4:
            moreDestination(TimerHubView(viewModel: timerViewModel))
        case 5:
            moreDestination(HabitTrackerView())
        case 12:
            moreDestination(ReadingView())
        case 13:
            moreDestination(ProjectRecordsView())
        case Self.stepsTabTag:
            moreDestination(StepCounterView())
        case 6:
            moreDestination(TravelItineraryView())
        case Self.travelAlbumTabTag:
            moreDestination(TravelAlbumView())
        case 8:
            moreDestination(FridgeInventoryView())
        case Self.farmTabTag:
            moreDestination(FarmView())
        case 15:
            moreDestination(GraduateTimetableView())
        case Self.graduateNotesTabTag:
            moreDestination(GraduateNotesView())
        case Self.ddayTabTag:
            moreDestination(DDayManagerView())
        case Self.notebooksTabTag:
            moreDestination(NotebookListView())
        case 10:
            moreDestination(SettingsView(showLogoutConfirm: $showLogoutConfirm))
        default:
            MoreMenuView(selectedTab: $selectedTab)
        }
    }

    private func moreDestination<Content: View>(_ content: Content) -> some View {
        content
            .safeAreaInset(edge: .top, spacing: 0) {
                HStack {
                    Button {
                        selectedTab = Self.moreTabTag
                    } label: {
                        Label("더보기", systemImage: "chevron.left")
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.bar)
                .overlay(alignment: .bottom) {
                    Divider()
                }
            }
    }
}

/// 커스텀 더보기. 토익은 목록에 넣지 않는다.
private struct MoreMenuView: View {
    @Binding var selectedTab: Int

    private let items: [(tag: Int, title: String, systemImage: String)] = [
        (MainTabView.farmTabTag, "포실이 성장", "leaf.fill"),
        (4, "타이머", "timer"),
        (5, "습관", "chart.bar.fill"),
        (12, "독서", "books.vertical.fill"),
        (13, "프로젝트", "folder.fill"),
        (11, "걸음", "figure.walk"),
        (6, "여행", "airplane"),
        (MainTabView.travelAlbumTabTag, "여행 앨범", "photo.on.rectangle.angled"),
        (8, "냉장고", "refrigerator.fill"),
        (15, "시간표", "graduationcap.fill"),
        (MainTabView.graduateNotesTabTag, "대학원 기록", "note.text"),
        (MainTabView.notebooksTabTag, "필기 노트", "pencil.and.scribble"),
        (MainTabView.ddayTabTag, "디데이", "calendar.badge.clock"),
        (9, "시계", "clock.fill"),
        (10, "설정", "gearshape.fill"),
    ]

    var body: some View {
        NavigationStack {
            List(items, id: \.tag) { item in
                Button {
                    selectedTab = item.tag
                } label: {
                    HStack {
                        Label(item.title, systemImage: item.systemImage)
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.footnote)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .navigationTitle("더보기")
        }
    }
}
