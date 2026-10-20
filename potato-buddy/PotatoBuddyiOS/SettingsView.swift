import SwiftUI
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @ObservedObject private var auth = AuthService.shared
    @Binding var showLogoutConfirm: Bool
    @AppStorage(StepCounterConstants.dailyGoalUserDefaultsKey) private var dailyStepGoal: Int = StepCounterConstants.defaultDailyGoal
    @AppStorage(NotificationService.enabledKey) private var notificationsEnabled: Bool = false
    @AppStorage(NotificationService.walkEnabledKey) private var walkNotificationEnabled: Bool = true
    @AppStorage(NotificationService.todoEnabledKey) private var todoNotificationEnabled: Bool = true
    @AppStorage(NotificationService.diaryEnabledKey) private var diaryNotificationEnabled: Bool = true
    @State private var showNotificationDeniedAlert = false
    @State private var showDeleteAccountConfirm = false
    @State private var isDeletingAccount = false
    @State private var deleteAccountError = ""

    private var effectiveDailyGoal: Int {
        dailyStepGoal > 0 ? dailyStepGoal : StepCounterConstants.defaultDailyGoal
    }

    var body: some View {
        NavigationView {
            List {
                Section {
                    HStack {
                        Label("현재 보유 젤리", systemImage: "shippingbox.fill")
                            .foregroundColor(.orange)
                        Spacer()
                        Text(jellyStore.balance.formatted())
                            .fontWeight(.semibold)
                    }
                } header: {
                    Text("젤리")
                }

                Section {
                    if StepCounterService.isAvailable {
                        Stepper(
                            value: Binding(
                                get: { effectiveDailyGoal },
                                set: { dailyStepGoal = $0 }
                            ),
                            in: StepCounterConstants.minDailyGoal...StepCounterConstants.maxDailyGoal,
                            step: StepCounterConstants.goalStepIncrement
                        ) {
                            Text("일일 목표: \(effectiveDailyGoal.formatted())보")
                        }

                        Text("걸음 탭에서 오늘 걸음 수와 마일스톤 젤리를 확인할 수 있어요.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("이 기기에서는 걸음 수 측정을 지원하지 않습니다.")
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("만보기")
                }

                Section {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.green)
                            .font(.title2)
                        Text(auth.userId.isEmpty ? "사용자" : auth.userId)
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                } header: {
                    Text("계정")
                }

                Section {
                    Toggle(isOn: $notificationsEnabled) {
                        Label("앱 알림", systemImage: "bell.fill")
                    }
                    .onChange(of: notificationsEnabled) { _, enabled in
                        Task {
                            if enabled {
                                let granted = await NotificationService.shared.requestPermission()
                                if granted {
                                    await NotificationService.shared.refreshIfEnabled()
                                } else {
                                    notificationsEnabled = false
                                    showNotificationDeniedAlert = true
                                }
                            } else {
                                NotificationService.shared.cancelAll()
                            }
                        }
                    }

                    if notificationsEnabled {
                        notificationTypeToggle(
                            "걷기 젤리", detail: "매일 오후 8시",
                            systemImage: "figure.walk", isOn: $walkNotificationEnabled
                        )
                        notificationTypeToggle(
                            "오늘 할 일", detail: "매일 오후 12시·7시",
                            systemImage: "checklist", isOn: $todoNotificationEnabled
                        )
                        notificationTypeToggle(
                            "일기", detail: "매일 오후 10시 · 오늘 일기를 썼으면 건너뜀",
                            systemImage: "book.closed.fill", isOn: $diaryNotificationEnabled
                        )
                    }
                } header: {
                    Text("알림")
                }

                Section {
                    Button(role: .destructive) {
                        showLogoutConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("로그아웃")
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showDeleteAccountConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "person.crop.circle.badge.xmark")
                            Text(isDeletingAccount ? "탈퇴 처리 중…" : "회원 탈퇴")
                            if isDeletingAccount {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(isDeletingAccount)
                } footer: {
                    Text("탈퇴하면 할일, 일기, 기록 등 모든 데이터와 계정이 삭제되며 되돌릴 수 없습니다.")
                }
            }
            .navigationTitle("설정")
            .navigationBarTitleDisplayMode(.large)
        }
        .task {
            await jellyStore.refresh()
        }
        .alert("알림 권한 필요", isPresented: $showNotificationDeniedAlert) {
            Button("설정 열기") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("알림을 받으려면 설정 > 포실이에서 알림을 허용해주세요.")
        }
        .alert("회원 탈퇴", isPresented: $showDeleteAccountConfirm) {
            Button("탈퇴", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("모든 데이터와 계정이 영구적으로 삭제됩니다. 정말 탈퇴할까요?")
        }
        .alert("탈퇴 실패", isPresented: Binding(
            get: { !deleteAccountError.isEmpty },
            set: { if !$0 { deleteAccountError = "" } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(deleteAccountError)
        }
    }

    /// 항목별 알림 토글: 바꾸면 예약된 알림을 다시 잡는다
    private func notificationTypeToggle(
        _ title: String, detail: String, systemImage: String, isOn: Binding<Bool>
    ) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Label(title, systemImage: systemImage)
                Text(detail)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .onChange(of: isOn.wrappedValue) { _, _ in
            Task { await NotificationService.shared.refreshIfEnabled() }
        }
    }

    @MainActor
    private func deleteAccount() async {
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        do {
            try await SupabaseService.shared.deleteMyAccount()
            auth.signOut()
        } catch {
            if !error.isCancellation {
                deleteAccountError = error.localizedDescription
            }
        }
    }
}
