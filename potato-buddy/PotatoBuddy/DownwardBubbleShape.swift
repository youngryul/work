import SwiftUI

/// 꼬리가 아래를 향하는 말풍선 Shape
struct DownwardBubbleShape: Shape {
    var cornerRadius: CGFloat = 18
    var tailHeight: CGFloat   = 14
    var tailWidth: CGFloat    = 20
    /// 꼬리 중심 X 위치 (0~1, 기본: 오른쪽 캐릭터 중앙 근처)
    var tailAnchor: CGFloat   = 0.75

    func path(in rect: CGRect) -> Path {
        let body = CGRect(x: 0, y: 0, width: rect.width, height: rect.height - tailHeight)
        let cx   = rect.width * tailAnchor
        var p    = Path()

        p.move(to: CGPoint(x: cornerRadius, y: 0))
        // 상단
        p.addLine(to: CGPoint(x: body.maxX - cornerRadius, y: 0))
        p.addArc(tangent1End: CGPoint(x: body.maxX, y: 0),
                 tangent2End: CGPoint(x: body.maxX, y: cornerRadius), radius: cornerRadius)
        // 우측
        p.addLine(to: CGPoint(x: body.maxX, y: body.maxY - cornerRadius))
        p.addArc(tangent1End: CGPoint(x: body.maxX, y: body.maxY),
                 tangent2End: CGPoint(x: body.maxX - cornerRadius, y: body.maxY), radius: cornerRadius)
        // 하단 → 꼬리 → 하단
        p.addLine(to: CGPoint(x: cx + tailWidth / 2, y: body.maxY))
        p.addLine(to: CGPoint(x: cx, y: rect.maxY))
        p.addLine(to: CGPoint(x: cx - tailWidth / 2, y: body.maxY))
        p.addLine(to: CGPoint(x: cornerRadius, y: body.maxY))
        p.addArc(tangent1End: CGPoint(x: 0, y: body.maxY),
                 tangent2End: CGPoint(x: 0, y: body.maxY - cornerRadius), radius: cornerRadius)
        // 좌측
        p.addLine(to: CGPoint(x: 0, y: cornerRadius))
        p.addArc(tangent1End: CGPoint(x: 0, y: 0),
                 tangent2End: CGPoint(x: cornerRadius, y: 0), radius: cornerRadius)
        p.closeSubpath()
        return p
    }
}
