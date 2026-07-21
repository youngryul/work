import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @ObservedObject private var auth = AuthService.shared
    @Binding var showLogoutConfirm: Bool
    @AppStorage(StepCounterConstants.dailyGoalUserDefaultsKey) private var dailyStepGoal: Int = StepCounterConstants.defaultDailyGoal

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
    }
}
