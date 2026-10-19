import UIKit

/// 여행 앨범을 폴라로이드 콜라주 한 장으로 합성한다.
/// 웹 `src/utils/travelAlbumImage.js`와 같은 레이아웃(1080px 폭, 1~3열, 기울어진 폴라로이드 + 마스킹 테이프)을 따른다.
enum TravelAlbumImageComposer {

    struct Item {
        let image: UIImage?
        let caption: String
    }

    private static let canvasWidth: CGFloat = 1080
    private static let paddingX: CGFloat = 60
    private static let headerHeight: CGFloat = 230
    private static let footerHeight: CGFloat = 110
    private static let gapX: CGFloat = 40
    private static let gapY: CGFloat = 64
    private static let polaroidFrame: CGFloat = 18
    private static let captionArea: CGFloat = 78
    private static let brandLabel = "포실이 · 여행 앨범"
    /// 폴라로이드 기울기(도)
    private static let rotations: [CGFloat] = [-4, 2, -2, 3, -3, 1, 4, -1]
    private static let titleColors: [UIColor] = [
        UIColor(red: 0xf8 / 255, green: 0x71 / 255, blue: 0x71 / 255, alpha: 1),
        UIColor(red: 0xfb / 255, green: 0xbf / 255, blue: 0x24 / 255, alpha: 1),
        UIColor(red: 0x4a / 255, green: 0xde / 255, blue: 0x80 / 255, alpha: 1),
        UIColor(red: 0x60 / 255, green: 0xa5 / 255, blue: 0xfa / 255, alpha: 1),
        UIColor(red: 0xa7 / 255, green: 0x8b / 255, blue: 0xfa / 255, alpha: 1),
    ]

    /// 손글씨 폰트 (없으면 시스템 폰트)
    private static func font(_ size: CGFloat) -> UIFont {
        UIFont(name: "HakgyoansimBoadmarkerR", size: size) ?? .systemFont(ofSize: size, weight: .semibold)
    }

    private static func columnCount(for count: Int) -> Int {
        if count <= 1 { return 1 }
        if count <= 4 { return 2 }
        return 3
    }

    static func compose(title: String, periodLabel: String, items: [Item]) -> UIImage? {
        guard !items.isEmpty else { return nil }

        let columns = columnCount(for: items.count)
        let rows = Int(ceil(Double(items.count) / Double(columns)))
        let cardWidth = (canvasWidth - paddingX * 2 - gapX * CGFloat(columns - 1)) / CGFloat(columns)
        let imageSize = cardWidth - polaroidFrame * 2
        let cardHeight = polaroidFrame + imageSize + captionArea
        let canvasHeight = headerHeight + CGFloat(rows) * cardHeight + CGFloat(rows - 1) * gapY + footerHeight + 40
        let size = CGSize(width: canvasWidth, height: canvasHeight)

        // 1x로 그려 결과 이미지가 정확히 1080px 폭이 되게 함
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)

        return renderer.image { ctx in
            let cg = ctx.cgContext

            // 배경 그라데이션
            let bgColors = [
                UIColor(red: 0xfa / 255, green: 0xf7 / 255, blue: 0xf2 / 255, alpha: 1).cgColor,
                UIColor(red: 0xf4 / 255, green: 0xf1 / 255, blue: 0xea / 255, alpha: 1).cgColor,
                UIColor(red: 0xee / 255, green: 0xf2 / 255, blue: 0xea / 255, alpha: 1).cgColor,
            ] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: bgColors, locations: [0, 0.55, 1]) {
                cg.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: canvasHeight), options: [])
            }

            // 헤더: 무지개 그라데이션 제목 + 기간
            let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
            let titleText = trimmedTitle.isEmpty ? "travel dump" : "\(trimmedTitle) dump"
            let titleFont = font(64)
            let fittedTitle = fit(titleText, font: titleFont, maxWidth: canvasWidth - paddingX * 2)
            let titleWidth = (fittedTitle as NSString).size(withAttributes: [.font: titleFont]).width
            let titleColor = gradientPatternColor(
                width: canvasWidth,
                startX: (canvasWidth - titleWidth) / 2,
                endX: (canvasWidth + titleWidth) / 2
            )
            drawCentered(fittedTitle, centerX: canvasWidth / 2, baselineY: 130, font: titleFont, color: titleColor)

            if !periodLabel.isEmpty {
                drawCentered(periodLabel, centerX: canvasWidth / 2, baselineY: 185, font: font(32),
                             color: UIColor(red: 0x57 / 255, green: 0x53 / 255, blue: 0x4e / 255, alpha: 1))
            }

            // 폴라로이드
            for (index, item) in items.enumerated() {
                let row = index / columns
                let col = index % columns
                // 마지막 줄이 덜 찼으면 가운데 정렬
                let itemsInRow = row == rows - 1 ? items.count - row * columns : columns
                let rowWidth = CGFloat(itemsInRow) * cardWidth + CGFloat(itemsInRow - 1) * gapX
                let rowStartX = (canvasWidth - rowWidth) / 2
                let x = rowStartX + CGFloat(col) * (cardWidth + gapX)
                let y = headerHeight + CGFloat(row) * (cardHeight + gapY)
                let rotation = rotations[index % rotations.count] * .pi / 180

                cg.saveGState()
                cg.translateBy(x: x + cardWidth / 2, y: y + cardHeight / 2)
                cg.rotate(by: rotation)
                cg.translateBy(x: -cardWidth / 2, y: -cardHeight / 2)

                // 카드 + 그림자
                cg.saveGState()
                cg.setShadow(offset: CGSize(width: 0, height: 10), blur: 24, color: UIColor(white: 0, alpha: 0.16).cgColor)
                UIColor.white.setFill()
                cg.fill(CGRect(x: 0, y: 0, width: cardWidth, height: cardHeight))
                cg.restoreGState()

                // 사진 (정사각형 cover)
                let photoRect = CGRect(x: polaroidFrame, y: polaroidFrame, width: imageSize, height: imageSize)
                if let image = item.image {
                    drawCover(image, in: photoRect, context: cg)
                } else {
                    UIColor(red: 0xe7 / 255, green: 0xe5 / 255, blue: 0xe4 / 255, alpha: 1).setFill()
                    cg.fill(photoRect)
                }

                // 마스킹 테이프
                cg.saveGState()
                cg.translateBy(x: cardWidth / 2, y: 0)
                cg.rotate(by: -2 * .pi / 180)
                let tape = CGRect(x: -40, y: -12, width: 80, height: 24)
                UIColor(white: 1, alpha: 0.75).setFill()
                cg.fill(tape)
                cg.setStrokeColor(UIColor(red: 0xd6 / 255, green: 0xd3 / 255, blue: 0xd1 / 255, alpha: 0.9).cgColor)
                cg.setLineWidth(2)
                cg.stroke(tape)
                cg.restoreGState()

                // 한줄 캡션
                if !item.caption.isEmpty {
                    let captionSize: CGFloat = columns == 3 ? 26 : 32
                    let captionFont = font(captionSize)
                    drawCentered(
                        fit(item.caption, font: captionFont, maxWidth: cardWidth - polaroidFrame * 2),
                        centerX: cardWidth / 2,
                        baselineY: polaroidFrame + imageSize + captionArea / 2 + captionSize / 3,
                        font: captionFont,
                        color: UIColor(red: 0x44 / 255, green: 0x40 / 255, blue: 0x3c / 255, alpha: 1)
                    )
                }

                cg.restoreGState()
            }

            // 하단 브랜드 문구
            drawCentered(brandLabel, centerX: canvasWidth / 2, baselineY: canvasHeight - 50, font: font(28),
                         color: UIColor(red: 0xa8 / 255, green: 0xa2 / 255, blue: 0x9e / 255, alpha: 1))
        }
    }

    // MARK: - 그리기 도우미

    /// 폭을 넘으면 말줄임
    private static func fit(_ text: String, font: UIFont, maxWidth: CGFloat) -> String {
        let attrs: [NSAttributedString.Key: Any] = [.font: font]
        if (text as NSString).size(withAttributes: attrs).width <= maxWidth { return text }
        var trimmed = text
        while !trimmed.isEmpty, ("\(trimmed)…" as NSString).size(withAttributes: attrs).width > maxWidth {
            trimmed.removeLast()
        }
        return "\(trimmed)…"
    }

    /// 기준선(baseline) 위치에 가운데 정렬로 그리기 (캔버스 fillText와 같은 기준)
    private static func drawCentered(_ text: String, centerX: CGFloat, baselineY: CGFloat, font: UIFont, color: UIColor) {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let size = (text as NSString).size(withAttributes: attrs)
        let origin = CGPoint(x: centerX - size.width / 2, y: baselineY - font.ascender)
        (text as NSString).draw(at: origin, withAttributes: attrs)
    }

    /// 제목 글자에 입힐 가로 그라데이션 패턴 색 (패턴은 캔버스 원점 기준으로 깔린다)
    private static func gradientPatternColor(width: CGFloat, startX: CGFloat, endX: CGFloat) -> UIColor {
        let size = CGSize(width: width, height: 220)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let colors = titleColors.map(\.cgColor) as CFArray
            let locations: [CGFloat] = (0..<titleColors.count).map { CGFloat($0) / CGFloat(titleColors.count - 1) }
            guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations) else { return }
            ctx.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: startX, y: 0),
                end: CGPoint(x: endX, y: 0),
                options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
            )
        }
        return UIColor(patternImage: image)
    }

    /// 영역을 꽉 채우도록 가운데를 잘라 그리기
    private static func drawCover(_ image: UIImage, in rect: CGRect, context: CGContext) {
        let imageSize = image.size
        guard imageSize.width > 0, imageSize.height > 0 else { return }
        let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
        let drawSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        let drawRect = CGRect(
            x: rect.midX - drawSize.width / 2,
            y: rect.midY - drawSize.height / 2,
            width: drawSize.width,
            height: drawSize.height
        )
        context.saveGState()
        context.clip(to: rect)
        image.draw(in: drawRect)
        context.restoreGState()
    }
}
