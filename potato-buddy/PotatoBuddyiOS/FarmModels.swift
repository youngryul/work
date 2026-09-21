import Foundation

/// 포실이 성장(농장) 상수 — 웹 `src/constants/farm.js`와 동일한 값
enum FarmConstants {
    static let maxStage = 10
    static let milkEventKey = "milk_feed"
    /// 한 번에 최대로 먹일 수 있는 횟수 상한
    static let maxFeedBatch = 200
    static let feedJellyCostDefault = 3
    static let feedJellyCostStage3Plus = 5
    static let feedJellyStageThreshold = 3
    static let stage2WelcomeSeedCount = 1
    static let stageGrowthSeedCount = 1
    static let stageGrowthSeedFromStage = 3

    /// 보유 젤리로 먹일 수 있는 최대 횟수
    static func maxFeedCount(jellyBalance: Int, feedJellyCost: Int, cap: Int = maxFeedBatch) -> Int {
        guard feedJellyCost > 0 else { return 0 }
        return min(max(0, cap), max(0, jellyBalance) / feedJellyCost)
    }

    static func stageLabel(_ stage: Int) -> String {
        if stage >= maxStage { return "\(maxStage)단계 · 최고 성장" }
        if stage == 1 { return "1단계 · 아기 포실이" }
        return "\(stage)단계 · 성장 중"
    }
}

/// 젤리 획득 안내 (웹 `JELLY_EARNING_GUIDE` 중 앱에서 실제로 적립되는 항목)
struct FarmJellyGuideItem: Identifiable {
    let id: String
    let icon: String
    let label: String
    let description: String
    let amount: Int

    static let all: [FarmJellyGuideItem] = [
        .init(id: "task", icon: "✅", label: "할 일 완료",
              description: "오늘 할 일을 완료하면 젤리를 받아요.",
              amount: JellyRewardAmount.taskComplete),
        .init(id: "study_timer", icon: "⏱️", label: "타이머 기록",
              description: "타이머·뽀모도로를 저장하면 10분당 젤리 1개를 받아요.",
              amount: JellyRewardAmount.studyTimerPer10Min),
        .init(id: "diary", icon: "📔", label: "일기 작성",
              description: "하루에 한 번, 일기를 쓰면 젤리를 받아요.",
              amount: JellyRewardAmount.diaryWrite),
        .init(id: "habit_tracker", icon: "📌", label: "습관 트래커 달성",
              description: "오늘 달성 2젤리, 이전 날짜 달성 1젤리 (트래커·날짜당 1회)",
              amount: JellyRewardAmount.habitTrackerFirstToday),
    ]
}

/// 2단계 이상에서 표시되는 대표 캐릭터
struct FarmActiveCharacter: Decodable, Equatable {
    let characterId: String?
    let name: String?
    let grade: String?
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case characterId, name, grade, imageUrl
        case characterIdSnake = "character_id"
        case imageUrlSnake = "image_url"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        characterId = try c.decodeIfPresent(String.self, forKey: .characterId)
            ?? c.decodeIfPresent(String.self, forKey: .characterIdSnake)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        grade = try c.decodeIfPresent(String.self, forKey: .grade)
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
            ?? c.decodeIfPresent(String.self, forKey: .imageUrlSnake)
    }
}

/// `get_my_farm_progress` 결과
struct FarmProgress: Decodable, Equatable {
    var stage: Int = 1
    var xp: Int = 0
    var farmUnlocked = false
    var nextStageXpRequired: Int = 100
    var maxStage: Int = FarmConstants.maxStage
    var seedCount: Int = 0
    var feedJellyCost: Int?
    var activeCharacter: FarmActiveCharacter?

    init() {}

    enum CodingKeys: String, CodingKey {
        case stage, xp, farmUnlocked, nextStageXpRequired, maxStage, seedCount, feedJellyCost, activeCharacter
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        stage = try c.decodeIfPresent(Int.self, forKey: .stage) ?? 1
        xp = try c.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        farmUnlocked = try c.decodeIfPresent(Bool.self, forKey: .farmUnlocked) ?? false
        nextStageXpRequired = try c.decodeIfPresent(Int.self, forKey: .nextStageXpRequired) ?? 100
        maxStage = try c.decodeIfPresent(Int.self, forKey: .maxStage) ?? FarmConstants.maxStage
        seedCount = try c.decodeIfPresent(Int.self, forKey: .seedCount) ?? 0
        feedJellyCost = try c.decodeIfPresent(Int.self, forKey: .feedJellyCost)
        activeCharacter = try c.decodeIfPresent(FarmActiveCharacter.self, forKey: .activeCharacter)
    }
}

/// `farm_xp_events`의 분유(먹이) 이벤트
struct FarmMilkEvent: Decodable, Equatable {
    let xpAmount: Int
    let minStage: Int?
    let maxStage: Int?

    enum CodingKeys: String, CodingKey {
        case xpAmount = "xp_amount"
        case minStage = "min_stage"
        case maxStage = "max_stage"
    }

    /// 현재 단계에서 먹이를 줄 수 있는지
    func canFeed(atStage stage: Int) -> Bool {
        stage >= (minStage ?? 1) && (maxStage == nil || stage <= maxStage!)
    }
}

/// 먹이 주기 결과 (한 번 / 최대로 먹이기 공통)
struct FarmFeedResult: Equatable {
    var feedCount = 0
    var xpAwarded = 0
    var jellySpent = 0
    var leveledUp = false
    var stage: Int?
    var seedGranted = 0
}

/// `process_farm_xp_event`, `feed_farm_milk_max` 응답 — camelCase/snake_case 모두 허용
struct FarmFeedResponse: Decodable {
    let feedCount: Int?
    let xpAwarded: Int
    let jellySpent: Int
    let leveledUp: Bool
    let stage: Int?
    let seedGranted: Int

    private struct AnyKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init(_ string: String) { stringValue = string }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { return nil }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)

        func int(_ camel: String, _ snake: String) -> Int? {
            if let v = try? c.decodeIfPresent(Int.self, forKey: AnyKey(camel)) { return v }
            if let v = try? c.decodeIfPresent(Int.self, forKey: AnyKey(snake)) { return v }
            return nil
        }
        func bool(_ camel: String, _ snake: String) -> Bool {
            if let v = try? c.decodeIfPresent(Bool.self, forKey: AnyKey(camel)) { return v }
            if let v = try? c.decodeIfPresent(Bool.self, forKey: AnyKey(snake)) { return v }
            return false
        }

        feedCount = int("feedCount", "feed_count")
        xpAwarded = int("xpAwarded", "xp_awarded") ?? 0
        jellySpent = int("jellySpent", "jelly_spent") ?? 0
        leveledUp = bool("leveledUp", "leveled_up")
        stage = int("stage", "stage")
        seedGranted = int("seedGranted", "seed_granted") ?? 0
    }
}
