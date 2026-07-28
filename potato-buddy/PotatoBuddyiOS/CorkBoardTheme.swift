import SwiftUI

/// 코르크 보드판 테마 (레퍼런스 보드 + 포실이/웹 그린 톤)
enum CorkBoardTheme {
    static let corkBase = Color(red: 0.78, green: 0.62, blue: 0.42)
    static let corkDark = Color(red: 0.62, green: 0.46, blue: 0.30)
    static let woodFrame = Color(red: 0.45, green: 0.30, blue: 0.16)
    static let stickyYellow = Color(red: 1.0, green: 0.93, blue: 0.55)
    static let stickyCream = Color(red: 0.99, green: 0.96, blue: 0.88)
    static let stickyBlue = Color(red: 0.72, green: 0.86, blue: 0.98)
    static let accentBlue = Color(red: 0.18, green: 0.38, blue: 0.78)
    static let accentYellow = Color(red: 1.0, green: 0.84, blue: 0.20)
    static let posilyGreen = Color(red: 0.22, green: 0.62, blue: 0.38)
    static let tapeOrange = Color(red: 0.95, green: 0.55, blue: 0.22)

    static func stickyColor(for id: String) -> Color {
        let palette = [stickyYellow, stickyCream, stickyBlue, Color.white]
        return palette[abs(id.hashValue) % palette.count]
    }

    /// 카드마다 살짝 다른 기울기 (-4° ~ 4°)
    static func tilt(for id: String) -> Double {
        let v = abs(id.hashValue % 9) - 4
        return Double(v) * 0.9
    }
}
