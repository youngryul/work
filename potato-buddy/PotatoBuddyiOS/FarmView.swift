import SwiftUI

// MARK: - 뷰모델

@MainActor
final class FarmViewModel: ObservableObject {
    struct LevelUp: Identifiable {
        let id = UUID()
        let stage: Int
        let seedGranted: Bool
    }

    @Published private(set) var progress = FarmProgress()
    @Published private(set) var milkEvent: FarmMilkEvent?
    @Published private(set) var settings: [String: String] = [:]
    @Published private(set) var isLoading = true
    @Published private(set) var isFeeding = false
    @Published var toastMessage = ""
    @Published var errorMessage = ""
    @Published var levelUp: LevelUp?

    private let jellyStore = JellyBalanceStore.shared

    var stage: Int { progress.stage }
    var isMaxStage: Bool { stage >= FarmConstants.maxStage }

    var feedJellyCost: Int {
        if let cost = progress.feedJellyCost { return cost }
        if stage >= FarmConstants.feedJellyStageThreshold {
            return Int(settings["milk_feed_jelly_cost_stage_3_plus"] ?? "") ?? FarmConstants.feedJellyCostStage3Plus
        }
        return Int(settings["milk_feed_jelly_cost_default"] ?? "") ?? FarmConstants.feedJellyCostDefault
    }

    var canFeed: Bool {
        guard let milkEvent, !isMaxStage else { return false }
        return milkEvent.canFeed(atStage: stage)
    }

    var maxFeedCount: Int {
        FarmConstants.maxFeedCount(jellyBalance: jellyStore.balance, feedJellyCost: feedJellyCost)
    }

    var xpPercent: Double {
        if isMaxStage { return 1 }
        let required = max(progress.nextStageXpRequired, 1)
        return min(1, Double(progress.xp) / Double(required))
    }

    var feedTitle: String { stage == 1 ? "분유 먹이기" : "음식 먹이기" }
    var feedEmoji: String { stage == 1 ? "🍼" : "🍱" }
    var feedNoun: String { stage == 1 ? "분유" : "음식" }

    var stageGuideMessage: String? {
        switch stage {
        case 1: return "2단계로 가면 농장이 열려요."
        case 2: return "3단계로 가면 포실이를 뽑을 수 있어요 · 작물을 구입할 수 있어요."
        default: return nil
        }
    }

    /// 단계에 맞는 원격 이미지 URL. 없으면 앱에 내장된 이미지를 쓴다.
    func imageURL(forStage stage: Int) -> URL? {
        if stage == 1 {
            return Self.remoteURL(settings["stage_1_image"])
        }
        if let url = Self.remoteURL(progress.activeCharacter?.imageUrl) { return url }
        return Self.remoteURL(settings["stage_2_image"])
    }

    func fallbackAsset(forStage stage: Int) -> String {
        stage == 1 ? "FarmBabyPosili" : "FarmPosili"
    }

    private static func remoteURL(_ string: String?) -> URL? {
        guard let string, string.hasPrefix("http") else { return nil }
        return URL(string: string)
    }

    func load(showSpinner: Bool = true) async {
        if showSpinner { isLoading = true }
        defer { isLoading = false }

        do {
            async let progressTask = SupabaseService.shared.getMyFarmProgress()
            async let eventTask = SupabaseService.shared.getMilkFeedEvent()
            async let settingsTask = SupabaseService.shared.getFarmSettingsMap()
            async let jellyTask: Void = jellyStore.refresh()

            progress = try await progressTask
            milkEvent = try await eventTask
            // 설정 조회 실패는 기본값으로 대체 가능하므로 화면을 막지 않는다.
            settings = (try? await settingsTask) ?? settings
            await jellyTask
        } catch {
            if error.isCancellation { return }
            errorMessage = error.localizedDescription
        }
    }

    func feedOnce() async {
        guard canFeed, !isFeeding else { return }
        guard jellyStore.balance >= feedJellyCost else {
            errorMessage = "젤리가 부족해요. 아래 방법으로 젤리를 모아보세요!"
            return
        }
        await performFeed {
            try await SupabaseService.shared.feedMilk()
        }
    }

    func feedMax() async {
        let count = maxFeedCount
        guard canFeed, !isFeeding, count >= 1 else { return }
        await performFeed {
            try await SupabaseService.shared.feedMilkMax(maxCount: count)
        }
    }

    private func performFeed(_ action: () async throws -> FarmFeedResult) async {
        isFeeding = true
        defer { isFeeding = false }

        do {
            let result = try await action()
            guard result.feedCount > 0 else {
                errorMessage = "먹일 수 있는 젤리가 부족해요."
                return
            }

            UINotificationFeedbackGenerator().notificationOccurred(.success)
            handle(result)
            await load(showSpinner: false)
        } catch {
            if error.isCancellation { return }
            errorMessage = error.localizedDescription
        }
    }

    private func handle(_ result: FarmFeedResult) {
        let countText = result.feedCount > 1 ? " \(result.feedCount)회" : ""

        if result.leveledUp, let newStage = result.stage {
            // 알림과 시트가 동시에 뜨면 충돌하므로 레벨업은 시트로만 안내한다.
            levelUp = LevelUp(stage: newStage, seedGranted: result.seedGranted > 0)
        } else {
            toastMessage = "\(feedNoun)를\(countText) 먹였어요! 성장 경험치 +\(result.xpAwarded)"
        }
    }
}

// MARK: - 화면

/// 포실이 성장 — 젤리로 먹이를 주며 10단계까지 키운다.
struct FarmView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @StateObject private var viewModel = FarmViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showMaxFeedConfirm = false

    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading && viewModel.milkEvent == nil {
                    ProgressView("포실이를 불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("포실이 성장")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    JellyBalanceBadgeView()
                }
            }
            .refreshable {
                await viewModel.load(showSpinner: false)
            }
            .alert("알림", isPresented: Binding(
                get: { !viewModel.errorMessage.isEmpty },
                set: { _ in viewModel.errorMessage = "" }
            )) {
                Button("확인") { viewModel.errorMessage = "" }
            } message: {
                Text(viewModel.errorMessage)
            }
            .alert("먹이 주기", isPresented: Binding(
                get: { !viewModel.toastMessage.isEmpty },
                set: { _ in viewModel.toastMessage = "" }
            )) {
                Button("확인") { viewModel.toastMessage = "" }
            } message: {
                Text(viewModel.toastMessage)
            }
            .confirmationDialog(
                "\(viewModel.feedNoun)를 최대로 먹일까요?",
                isPresented: $showMaxFeedConfirm,
                titleVisibility: .visible
            ) {
                Button("\(viewModel.maxFeedCount)회 먹이기") {
                    Task { await viewModel.feedMax() }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("보유 젤리로 \(viewModel.feedNoun)를 최대 \(viewModel.maxFeedCount)회 먹여요. (젤리 \(viewModel.maxFeedCount * viewModel.feedJellyCost)개)")
            }
            .sheet(item: $viewModel.levelUp) { levelUp in
                FarmLevelUpSheet(
                    stage: levelUp.stage,
                    seedGranted: levelUp.seedGranted,
                    imageURL: viewModel.imageURL(forStage: levelUp.stage),
                    fallbackAsset: viewModel.fallbackAsset(forStage: levelUp.stage)
                )
                .presentationDetents([.medium])
            }
        }
        .navigationViewStyle(.stack)
        .task { await viewModel.load() }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { await viewModel.load(showSpinner: false) }
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 16) {
                characterCard
                if viewModel.canFeed, let event = viewModel.milkEvent {
                    feedCard(event: event)
                }
                jellyGuideCard
            }
            .padding()
        }
    }

    // MARK: 캐릭터 & 성장

    private var characterCard: some View {
        VStack(spacing: 12) {
            Text(FarmConstants.stageLabel(viewModel.stage))
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.green)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color.white.opacity(0.85)))
                .overlay(Capsule().stroke(Color.green.opacity(0.3), lineWidth: 1))

            FarmCharacterImage(
                url: viewModel.imageURL(forStage: viewModel.stage),
                fallbackAsset: viewModel.fallbackAsset(forStage: viewModel.stage)
            )
            .frame(width: viewModel.stage == 1 ? 180 : 160, height: viewModel.stage == 1 ? 180 : 160)
            .shadow(color: .black.opacity(0.15), radius: 8, y: 4)

            if viewModel.stage >= 2, let name = viewModel.progress.activeCharacter?.name {
                Text(name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.green)
            } else if viewModel.stage >= 3 {
                Text("마이페이지에서 내 캐릭터로 설정하면 여기에 표시돼요!")
                    .font(.caption)
                    .foregroundColor(.green)
                    .multilineTextAlignment(.center)
            }

            if viewModel.isMaxStage {
                Text("최고 단계에 도달했어요! 🎉")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.green)
            } else {
                xpBar
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 24)
                .fill(LinearGradient(
                    colors: [Color(red: 0.88, green: 0.95, blue: 1.0),
                             Color(red: 0.94, green: 0.98, blue: 0.93),
                             Color(red: 1.0, green: 0.97, blue: 0.90)],
                    startPoint: .top, endPoint: .bottom
                ))
        )
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.green.opacity(0.3), lineWidth: 2))
    }

    private var xpBar: some View {
        VStack(spacing: 6) {
            HStack {
                Text("\(viewModel.stage)단계 → \(viewModel.stage + 1)단계")
                Spacer()
                Text("\(viewModel.progress.xp) / \(viewModel.progress.nextStageXpRequired)")
                    .fontWeight(.bold)
            }
            .font(.caption)
            .foregroundColor(.green)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.75))
                    Capsule()
                        .fill(LinearGradient(colors: [.pink, .orange], startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * viewModel.xpPercent)
                        .animation(.easeOut(duration: 0.5), value: viewModel.xpPercent)
                }
            }
            .frame(height: 12)
            .overlay(Capsule().stroke(Color.green.opacity(0.3), lineWidth: 1))

            if let guide = viewModel.stageGuideMessage {
                Text(guide)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.green)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.1)))
            }
        }
        .frame(maxWidth: 320)
        .padding(.top, 4)
    }

    // MARK: 먹이 주기

    private func feedCard(event: FarmMilkEvent) -> some View {
        let cost = viewModel.feedJellyCost
        let maxCount = viewModel.maxFeedCount

        return VStack(alignment: .leading, spacing: 10) {
            Text("\(viewModel.feedEmoji) \(viewModel.feedTitle)")
                .font(.headline)

            Text("젤리 \(cost)개를 사용해 \(viewModel.feedNoun)를 먹이면 성장 경험치 +\(event.xpAmount)를 얻어요.")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button {
                Task { await viewModel.feedOnce() }
            } label: {
                Text(viewModel.isFeeding
                     ? "먹이는 중…"
                     : "\(viewModel.feedEmoji) \(viewModel.feedTitle) (젤리 \(cost) · XP +\(event.xpAmount))")
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(LinearGradient(colors: [.pink, Color(red: 1, green: 0.4, blue: 0.5)],
                                                startPoint: .leading, endPoint: .trailing))
                    )
            }
            .disabled(viewModel.isFeeding || jellyStore.balance < cost)
            .opacity(viewModel.isFeeding || jellyStore.balance < cost ? 0.5 : 1)

            if maxCount > 1 {
                Button {
                    showMaxFeedConfirm = true
                } label: {
                    Text(viewModel.isFeeding
                         ? "먹이는 중…"
                         : "\(viewModel.feedEmoji) 최대로 먹이기 (\(maxCount)회 · 젤리 \(maxCount * cost) · XP +\(maxCount * event.xpAmount))")
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(.pink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.pink.opacity(0.08)))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.pink.opacity(0.4), lineWidth: 1.5))
                }
                .disabled(viewModel.isFeeding)
                .opacity(viewModel.isFeeding ? 0.5 : 1)
            }

            Text("보유 젤리: \(jellyStore.balance.formatted())개")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
    }

    // MARK: 젤리 획득 방법

    private var jellyGuideCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("🍬 젤리 얻는 방법")
                .font(.headline)

            Text("일상 활동으로 젤리를 모아 포실이에게 먹이를 주세요.")
                .font(.subheadline)
                .foregroundColor(.secondary)

            ForEach(FarmJellyGuideItem.all) { item in
                HStack(alignment: .top, spacing: 12) {
                    Text(item.icon).font(.title3)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.label).font(.subheadline.weight(.semibold))
                        Text(item.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer(minLength: 8)
                    Text("+\(item.amount)")
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(.orange)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.orange.opacity(0.08)))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
    }
}

// MARK: - 캐릭터 이미지

/// 원격 URL(캐릭터 이미지)이 있으면 불러오고, 없거나 실패하면 앱 내장 이미지를 보여준다.
private struct FarmCharacterImage: View {
    let url: URL?
    let fallbackAsset: String

    var body: some View {
        if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit()
                case .failure:
                    fallback
                default:
                    ProgressView()
                }
            }
        } else {
            fallback
        }
    }

    private var fallback: some View {
        Image(fallbackAsset).resizable().scaledToFit()
    }
}

// MARK: - 단계 업 시트

private struct FarmLevelUpSheet: View {
    let stage: Int
    let seedGranted: Bool
    let imageURL: URL?
    let fallbackAsset: String
    @Environment(\.dismiss) private var dismiss

    private var message: String {
        if stage == 2 && seedGranted {
            return "농장이 열렸어요! 씨앗 \(FarmConstants.stage2WelcomeSeedCount)개를 받았어요."
        }
        if seedGranted && stage >= FarmConstants.stageGrowthSeedFromStage {
            return "씨앗 \(FarmConstants.stageGrowthSeedCount)개를 받았어요!"
        }
        if stage >= FarmConstants.maxStage {
            return "포실이가 최고 단계까지 자랐어요!"
        }
        return "포실이가 한 단계 더 자랐어요. 계속 키워보세요!"
    }

    var body: some View {
        VStack(spacing: 14) {
            FarmCharacterImage(url: imageURL, fallbackAsset: fallbackAsset)
                .frame(width: 130, height: 130)

            Text("\(stage)단계로 성장!")
                .font(.title2.bold())
                .foregroundColor(.green)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button {
                dismiss()
            } label: {
                Text("확인")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.green))
            }
        }
        .padding(24)
    }
}
