import Foundation

struct DiaryItem: Codable, Identifiable {
    let id: String
    let date: String         // YYYY-MM-DD
    let content: String
    let imageUrl: String?
    let imagePrompt: String?
    let emotion: String?
    let fourCutUrl: String?
    let fourCutSceneUrls: [String]
    let coverImageUrl: String?
    let attachedImages: [String]

    enum CodingKeys: String, CodingKey {
        case id, date, content, emotion
        case imageUrl = "image_url"
        case imagePrompt = "image_prompt"
        case fourCutUrl = "four_cut_url"
        case fourCutSceneUrls = "four_cut_scene_urls"
        case coverImageUrl = "cover_image_url"
        case attachedImages = "attached_images"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        date = try c.decode(String.self, forKey: .date)
        content = try c.decode(String.self, forKey: .content)
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        imagePrompt = try c.decodeIfPresent(String.self, forKey: .imagePrompt)
        emotion = try c.decodeIfPresent(String.self, forKey: .emotion)
        fourCutUrl = try c.decodeIfPresent(String.self, forKey: .fourCutUrl)
        fourCutSceneUrls = try c.decodeIfPresent([String].self, forKey: .fourCutSceneUrls) ?? []
        coverImageUrl = try c.decodeIfPresent(String.self, forKey: .coverImageUrl)
        attachedImages = try c.decodeIfPresent([String].self, forKey: .attachedImages) ?? []
    }

    init(
        id: String, date: String, content: String,
        imageUrl: String? = nil, imagePrompt: String? = nil, emotion: String? = nil,
        fourCutUrl: String? = nil, fourCutSceneUrls: [String] = [],
        coverImageUrl: String? = nil, attachedImages: [String] = []
    ) {
        self.id = id
        self.date = date
        self.content = content
        self.imageUrl = imageUrl
        self.imagePrompt = imagePrompt
        self.emotion = emotion
        self.fourCutUrl = fourCutUrl
        self.fourCutSceneUrls = fourCutSceneUrls
        self.coverImageUrl = coverImageUrl
        self.attachedImages = attachedImages
    }

    /// 달력 셀 등에 쓸 대표 썸네일. 우선순위: 대문 지정 > 1컷 이미지 > 4컷 첫 장면 > 4컷 스트립
    var thumbnailUrl: String? {
        coverImageUrl ?? imageUrl ?? fourCutSceneUrls.first ?? fourCutUrl
    }

    /// 대문 이미지로 고를 수 있는 후보 목록 (중복 제거, 최대 5개)
    var coverCandidates: [String] {
        var seen = Set<String>()
        var result: [String] = []
        var ordered = fourCutSceneUrls
        if let fourCutUrl { ordered.append(fourCutUrl) }
        ordered.append(contentsOf: attachedImages)
        if let imageUrl { ordered.append(imageUrl) }
        for url in ordered where !url.isEmpty {
            if seen.insert(url).inserted {
                result.append(url)
            }
            if result.count >= 5 { break }
        }
        return result
    }

    var hasFourCut: Bool { fourCutUrl != nil && !fourCutSceneUrls.isEmpty }
    var isPhotoFourCut: Bool { hasFourCut && attachedImages.count == fourCutSceneUrls.count && !attachedImages.isEmpty }
}
