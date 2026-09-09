import UIKit

/// 그림일기 Sketchbook 디자인(핸드오프 `Diary Sketchbook.dc.html`)의 4컷 스트립·공유카드 룩을
/// `UIGraphicsImageRenderer`로 합성하는 순수 함수 모음. 네트워킹은 하지 않는다.
enum DiarySketchImageComposer {

    private static let ink = UIColor(red: 0x33 / 255, green: 0x30 / 255, blue: 0x2b / 255, alpha: 1)
    private static let paper = UIColor(red: 0xfb / 255, green: 0xf7 / 255, blue: 0xec / 255, alpha: 1)
    private static let muted = UIColor(red: 0x8a / 255, green: 0x82 / 255, blue: 0x72 / 255, alpha: 1)
    private static let green = UIColor(red: 0x16 / 255, green: 0xa3 / 255, blue: 0x4a / 255, alpha: 1)

    /// 4컷 스트립: 흰 도화지 카드 + 4개 셀 + 하단 날짜 라벨. (`Diary Sketchbook.dc.html` 4컷 뷰어 섹션 참고)
    static func composeFourCutStrip(images: [UIImage], dateLabel: String) -> UIImage {
        let scale: CGFloat = 3
        let cardW: CGFloat = 168 * scale
        let pad: CGFloat = 9 * scale
        let gap: CGFloat = 7 * scale
        let cellH: CGFloat = 104 * scale
        let borderW: CGFloat = 2.5 * scale
        let cellCount = max(images.count, 1)
        let cardH = pad * 2 + CGFloat(cellCount) * cellH + CGFloat(cellCount - 1) * gap + 26 * scale

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: cardW, height: cardH))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            UIColor.white.setFill()
            cg.fill(CGRect(x: 0, y: 0, width: cardW, height: cardH))

            var y = pad
            for i in 0..<cellCount {
                let cellRect = CGRect(x: pad, y: y, width: cardW - pad * 2, height: cellH)
                if i < images.count {
                    drawImage(images[i], in: cellRect, context: cg)
                } else {
                    UIColor(white: 0.93, alpha: 1).setFill()
                    cg.fill(cellRect)
                }
                UIColor(white: 0, alpha: 0.12).setStroke()
                let border = UIBezierPath(rect: cellRect)
                border.lineWidth = 1
                border.stroke()
                y += cellH + gap
            }

            let dateRect = CGRect(x: 0, y: cardH - 20 * scale, width: cardW, height: 18 * scale)
            drawCentered(dateLabel, in: dateRect, font: .systemFont(ofSize: 12 * scale), color: muted)

            cg.setStrokeColor(ink.cgColor)
            cg.setLineWidth(borderW)
            cg.stroke(CGRect(x: borderW / 2, y: borderW / 2, width: cardW - borderW, height: cardH - borderW))
        }
    }

    /// 공유카드 1080x1350: 파스텔 그라데이션 배경 + 종이 질감 카드(링 도트 + 초록 밑줄 + 이미지 + 감정 도장 + 브랜드 라벨).
    /// (`Diary Sketchbook.dc.html` 공유카드 섹션 참고)
    static func composeShareCard(image: UIImage?, dateLabel: String, emotionLabel: String) -> UIImage {
        let size = CGSize(width: 1080, height: 1350)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let cg = ctx.cgContext

            let bgColors = [
                UIColor(red: 0xfe / 255, green: 0xf5 / 255, blue: 0xe7 / 255, alpha: 1).cgColor,
                UIColor(red: 0xf8 / 255, green: 0xd7 / 255, blue: 0xda / 255, alpha: 1).cgColor,
                UIColor(red: 0xd1 / 255, green: 0xec / 255, blue: 0xf1 / 255, alpha: 1).cgColor,
            ]
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: bgColors as CFArray, locations: [0, 0.5, 1]) {
                cg.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }

            let cardInset: CGFloat = 40
            let cardRect = CGRect(x: cardInset, y: cardInset, width: size.width - cardInset * 2, height: size.height - cardInset * 2)
            paper.setFill()
            UIBezierPath(rect: cardRect).fill()
            cg.setStrokeColor(ink.cgColor)
            cg.setLineWidth(8)
            cg.stroke(cardRect.insetBy(dx: 4, dy: 4))

            var ringX = cardRect.minX + cardRect.width * 0.16
            let ringY = cardRect.minY - 4
            for _ in 0..<6 {
                let ringRect = CGRect(x: ringX, y: ringY, width: 26, height: 26)
                paper.setFill()
                UIBezierPath(ovalIn: ringRect).fill()
                muted.setStroke()
                let ring = UIBezierPath(ovalIn: ringRect)
                ring.lineWidth = 5
                ring.stroke()
                ringX += cardRect.width * 0.13
            }

            var y = cardRect.minY + 70
            drawCentered(dateLabel, in: CGRect(x: cardRect.minX, y: y, width: cardRect.width, height: 60), font: .systemFont(ofSize: 46, weight: .semibold), color: ink)
            y += 66

            let underlineRect = CGRect(x: cardRect.midX - 90, y: y, width: 180, height: 12)
            UIColor(red: 0xbb / 255, green: 0xf7 / 255, blue: 0xd0 / 255, alpha: 1).setFill()
            UIBezierPath(roundedRect: underlineRect, cornerRadius: 6).fill()
            y += 40

            let imageRect = CGRect(x: cardRect.minX + 32, y: y, width: cardRect.width - 64, height: cardRect.height - 320)
            cg.setStrokeColor(ink.cgColor)
            cg.setLineWidth(5)
            cg.stroke(imageRect)
            if let image {
                drawImage(image, in: imageRect.insetBy(dx: 6, dy: 6), context: cg)
            } else {
                UIColor(white: 0.93, alpha: 1).setFill()
                UIBezierPath(rect: imageRect.insetBy(dx: 6, dy: 6)).fill()
            }
            y = imageRect.maxY + 36

            let stampSize = CGSize(width: 220, height: 90)
            let stampRect = CGRect(x: cardRect.midX - stampSize.width / 2, y: y, width: stampSize.width, height: stampSize.height)
            let stamp = UIBezierPath(ovalIn: stampRect)
            green.setStroke()
            stamp.lineWidth = 6
            stamp.stroke()
            drawCentered(emotionLabel, in: stampRect, font: .systemFont(ofSize: 32, weight: .semibold), color: UIColor(red: 0x15 / 255, green: 0x80 / 255, blue: 0x3d / 255, alpha: 1))
            y += stampSize.height + 24

            drawCentered("posily 그림일기", in: CGRect(x: cardRect.minX, y: y, width: cardRect.width, height: 30), font: .systemFont(ofSize: 22), color: muted.withAlphaComponent(0.8))
        }
    }

    private static func drawImage(_ image: UIImage, in rect: CGRect, context: CGContext) {
        context.saveGState()
        context.clip(to: rect)
        let imageSize = image.size
        guard imageSize.width > 0, imageSize.height > 0 else {
            context.restoreGState()
            return
        }
        let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
        let drawSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        let origin = CGPoint(x: rect.midX - drawSize.width / 2, y: rect.midY - drawSize.height / 2)
        image.draw(in: CGRect(origin: origin, size: drawSize))
        context.restoreGState()
    }

    private static func drawCentered(_ text: String, in rect: CGRect, font: UIFont, color: UIColor) {
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
        let textSize = text.size(withAttributes: attrs)
        let textRect = CGRect(x: rect.minX, y: rect.midY - textSize.height / 2, width: rect.width, height: textSize.height)
        text.draw(in: textRect, withAttributes: attrs)
    }
}
