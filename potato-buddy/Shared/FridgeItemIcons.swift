import Foundation

struct FridgeItemIcon {
    let emoji: String
    let imageUrl: String?
}

enum FridgeItemIcons {
    static let defaultEmoji = "🥗"

    private static let keywordGroups: [(keywords: [String], emoji: String)] = [
        (["우유", "밀크", "두유", "요거트", "요구르트", "치즈", "버터"], "🥛"),
        (["계란", "달걀", "에그"], "🥚"),
        (["김치", "깍두기", "열무"], "🥬"),
        (["배추", "상추", "양상추", "시금치", "케일", "청경채"], "🥬"),
        (["당근", "무", "오이", "호박", "가지", "파프리카", "피망"], "🥕"),
        (["토마토", "방울토마토"], "🍅"),
        (["양파", "대파", "쪽파", "마늘", "생강"], "🧅"),
        (["감자", "고구마", "토란"], "🥔"),
        (["버섯", "표고", "느타리", "팽이"], "🍄"),
        (["사과", "배", "포도", "딸기", "바나나", "오렌지", "귤", "복숭아", "수박", "참외", "키위", "망고"], "🍎"),
        (["소고기", "돼지고기", "닭고기", "닭", "삼겹", "목살", "갈비", "베이컨", "햄", "소시지", "고기"], "🥩"),
        (["생선", "고등어", "연어", "참치", "새우", "오징어", "문어", "조개", "해물"], "🐟"),
        (["두부", "순두부", "유부"], "🧈"),
        (["밥", "쌀", "현미", "잡곡"], "🍚"),
        (["면", "라면", "국수", "파스타", "우동", "소면"], "🍜"),
        (["빵", "토스트", "식빵", "베이글"], "🍞"),
        (["계란말이", "반찬", "나물"], "🍱"),
        (["주스", "음료", "콜라", "사이다", "맥주", "와인", "소주", "커피", "차"], "🧃"),
        (["아이스크림", "빙수", "냉동"], "🍦"),
        (["피자", "만두", "치킨", "튀김"], "🍕"),
        (["소스", "케첩", "마요네즈", "간장", "된장", "고추장", "잼", "꿀"], "🫙"),
        (["오일", "기름", "참기름", "식용유"], "🫒"),
        (["과자", "초콜릿", "쿠키", "스낵"], "🍪"),
        (["견과", "아몬드", "호두"], "🥜"),
    ]

    static func resolve(name: String) -> FridgeItemIcon {
        let normalized = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            return FridgeItemIcon(emoji: defaultEmoji, imageUrl: nil)
        }

        for group in keywordGroups {
            if group.keywords.contains(where: { normalized.contains($0.lowercased()) }) {
                return FridgeItemIcon(emoji: group.emoji, imageUrl: nil)
            }
        }
        return FridgeItemIcon(emoji: defaultEmoji, imageUrl: nil)
    }
}
