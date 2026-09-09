import SwiftUI

/// 그림일기 Sketchbook 디자인에 쓰이는 손글씨 폰트("학교안심 보드마카 R").
/// `project.yml`의 `UIAppFonts`에 `Hakgyoansim_BoardmarkerR.ttf`가 등록되어 있어야 한다.
extension Font {
    static func sketchbook(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("HakgyoansimBoadmarkerR", size: size)
    }
}
