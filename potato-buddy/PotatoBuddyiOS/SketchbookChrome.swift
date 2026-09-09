import SwiftUI

/// 그림일기 Sketchbook 디자인(핸드오프 `Diary Sketchbook.dc.html`)의 공용 색상·시각 요소.
enum SketchbookStyle {
    static let paper = Color(red: 0xfb / 255, green: 0xf7 / 255, blue: 0xec / 255)
    static let outerBackground = Color(red: 0xdc / 255, green: 0xdf / 255, blue: 0xd3 / 255)
    static let ink = Color(red: 0x33 / 255, green: 0x30 / 255, blue: 0x2b / 255)
    static let muted = Color(red: 0x8a / 255, green: 0x82 / 255, blue: 0x72 / 255)
    static let mutedLight = Color(red: 0xa8 / 255, green: 0xa0 / 255, blue: 0x8c / 255)
    static let green = Color(red: 0x4a / 255, green: 0xde / 255, blue: 0x80 / 255)
    static let greenDark = Color(red: 0x16 / 255, green: 0xa3 / 255, blue: 0x4a / 255)
    static let greenText = Color(red: 0x15 / 255, green: 0x80 / 255, blue: 0x3d / 255)
    static let underlinePink = Color(red: 0xf8 / 255, green: 0xd7 / 255, blue: 0xda / 255)
    static let underlineMint = Color(red: 0xbb / 255, green: 0xf7 / 255, blue: 0xd0 / 255)
    static let ringStroke = Color(red: 0x9a / 255, green: 0x93 / 255, blue: 0x82 / 255)

    static let hardShadow = Color.black.opacity(0.3)
}

/// 도화지 질감 배경 (미세 도트 패턴을 얇은 그리드 오버레이로 근사).
struct SketchbookPaperBackground: View {
    var body: some View {
        SketchbookStyle.paper
            .overlay(
                Canvas { context, size in
                    let dotColor = Color.black.opacity(0.05)
                    let spacing: CGFloat = 4
                    var x: CGFloat = 0
                    while x < size.width {
                        var y: CGFloat = 0
                        while y < size.height {
                            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1, height: 1)), with: .color(dotColor))
                            y += spacing
                        }
                        x += spacing
                    }
                }
            )
    }
}

/// 스케치북 상단 링제본.
struct SketchbookRingBinding: View {
    var ringCount: Int = 11

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(red: 0xef / 255, green: 0xe8 / 255, blue: 0xd6 / 255), Color(red: 0xe6 / 255, green: 0xde / 255, blue: 0xc8 / 255)], startPoint: .top, endPoint: .bottom)
                .frame(height: 26)
                .overlay(
                    HStack {
                        ForEach(0..<ringCount, id: \.self) { _ in
                            Circle()
                                .fill(SketchbookStyle.paper)
                                .frame(width: 13, height: 13)
                                .overlay(Circle().stroke(SketchbookStyle.ringStroke, lineWidth: 2.5))
                        }
                    }
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity)
                    .offset(y: 3),
                    alignment: .top
                )
            Rectangle()
                .fill(Color.black.opacity(0.18))
                .frame(height: 1)
        }
    }
}

/// 감정 도장 스타일 뱃지.
struct EmotionStampView: View {
    let emotion: String
    var rotation: Double = -6

    var body: some View {
        Text(emotion)
            .font(.system(size: 15))
            .foregroundStyle(SketchbookStyle.greenText)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(minWidth: 66)
            .background(SketchbookStyle.greenDark.opacity(0.08))
            .overlay(
                Ellipse().stroke(SketchbookStyle.greenDark, lineWidth: 2.5)
            )
            .rotationEffect(.degrees(rotation))
    }
}

/// 손글씨 밑줄 (얇고 살짝 기울어진 형광펜 라인).
struct SketchUnderline: View {
    var color: Color = SketchbookStyle.underlineMint
    var width: CGFloat = 118
    var rotation: Double = -0.6

    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(color)
            .frame(width: width, height: 7)
            .rotationEffect(.degrees(rotation))
    }
}
