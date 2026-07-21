import SwiftUI

/// 오늘 걸음 · 마일스톤 젤리 이벤트 전용 화면
struct StepCounterView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @StateObject private var stepCounter = StepCounterViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var jellyEarnedMessage = ""
    @State private var errorMessage = ""

    var body: some View {
        NavigationView {
            ScrollView {
                StepCounterCardView(
                    viewModel: stepCounter,
                    onJellyEarned: { message in
                        jellyEarnedMessage = message
                        Task { await jellyStore.refresh() }
                    },
                    onClaimError: { message in
                        errorMessage = message
                    }
                )
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("걸음")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    JellyBalanceBadgeView()
                }
            }
            .refreshable {
                await stepCounter.refresh()
                await jellyStore.refresh()
            }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { _ in errorMessage = "" }
            )) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
            .alert("젤리 획득", isPresented: Binding(
                get: { !jellyEarnedMessage.isEmpty },
                set: { _ in jellyEarnedMessage = "" }
            )) {
                Button("확인") { jellyEarnedMessage = "" }
            } message: {
                Text(jellyEarnedMessage)
            }
        }
        .task {
            async let stepsLoad: Void = stepCounter.requestAccessAndRefresh()
            async let jellyLoad: Void = jellyStore.refresh()
            _ = await (stepsLoad, jellyLoad)
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await stepCounter.refresh()
                    await jellyStore.refresh()
                }
            }
        }
    }
}
