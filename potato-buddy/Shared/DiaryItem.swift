import Foundation

struct DiaryItem: Codable, Identifiable {
    let id: String
    let date: String         // YYYY-MM-DD
    let content: String
    let imageUrl: String?
    let emotion: String?

    enum CodingKeys: String, CodingKey {
        case id, date, content, emotion
        case imageUrl = "image_url"
    }
}
