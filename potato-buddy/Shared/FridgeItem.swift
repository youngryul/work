import Foundation

struct FridgeItem: Codable, Identifiable, Hashable {
    let id: String
    let zone: String
    let name: String
    let quantity: Int
    let status: String
    let registeredAt: String
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case zone
        case name
        case quantity
        case status
        case registeredAt = "registered_at"
        case expiresAt = "expires_at"
    }
}
