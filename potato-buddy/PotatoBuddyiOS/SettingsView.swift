import SwiftUI
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @ObservedObject private var auth = AuthService.shared
    @Binding var showLogoutConfirm: Bool
    @AppStorage(StepCounterConstants.dailyGoalUserDefaultsKey) private var dailyStepGoal: Int = StepCounterConstants.defaultDailyGoal
    @AppStorage(NotificationService.enabledKey) private var notificationsEnabled: Bool = false
    @State private var showNotificationDeniedAlert = false

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
                        VStack(alignment: .leading, spacing: 4) {
                            Text("• 걷기 젤리 알림: 매일 오후 8시")
                            Text("• 오늘 할 일 알림: 매일 오후 12시·7시")
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
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
    }
}
