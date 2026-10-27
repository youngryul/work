import UIKit
import PencilKit
import PDFKit

/// 페이지 크기 규칙 — 필기 좌표는 항상 페이지 기준 pt(가로 768)로 저장한다.
enum NotebookPageLayout {
    static let width: CGFloat = 768
    /// A4 비율 기본 페이지
    static let defaultSize = CGSize(width: 768, height: 1086)

    /// PDF 페이지는 원본 비율을 따르고, 나머지는 A4
    static func size(for pdfPage: PDFPage?) -> CGSize {
        guard let pdfPage else { return defaultSize }
        var bounds = pdfPage.bounds(for: .mediaBox).size
        if pdfPage.rotation % 180 != 0 {
            bounds = CGSize(width: bounds.height, height: bounds.width)
        }
        guard bounds.width > 0, bounds.height > 0 else { return defaultSize }
        return CGSize(width: width, height: (width * bounds.height / bounds.width).rounded())
    }
}

/// 페이지 한 장을 그리기 위한 재료
struct NotebookRenderContent {
    var size: CGSize
    var background: UIImage
    var photos: [(image: UIImage, frame: CGRect)]
    var drawing: PKDrawing
}

/// 속지·미리보기·내보내기 렌더링
enum NotebookRenderer {
    private static let paperColor = UIColor(red: 1.0, green: 0.996, blue: 0.98, alpha: 1)
    private static let lineColor = UIColor(red: 0.74, green: 0.82, blue: 0.9, alpha: 1)
    private static let marginColor = UIColor(red: 0.95, green: 0.7, blue: 0.7, alpha: 1)
    private static let gridColor = UIColor(white: 0.85, alpha: 1)
    private static let dotColor = UIColor(white: 0.7, alpha: 1)

    private static let lineSpacing: CGFloat = 32
    private static let lineTopMargin: CGFloat = 96
    private static let lineLeftMargin: CGFloat = 64
    private static let gridSpacing: CGFloat = 24

    /// 속지(또는 PDF 페이지) 배경 이미지
    static func backgroundImage(paper: NotebookPaperType, size: CGSize, pdfPage: PDFPage?) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 2
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let rect = CGRect(origin: .zero, size: size)
            (pdfPage == nil ? paperColor : UIColor.white).setFill()
            context.fill(rect)

            if let pdfPage {
                let thumbnail = pdfPage.thumbnail(
                    of: CGSize(width: size.width * 2, height: size.height * 2),
                    for: .mediaBox
                )
                thumbnail.draw(in: rect)
            } else {
                drawPaper(paper, in: context.cgContext, size: size)
            }
        }
    }

    private static func drawPaper(_ paper: NotebookPaperType, in ctx: CGContext, size: CGSize) {
        switch paper {
        case .lined:
            ctx.setStrokeColor(lineColor.cgColor)
            ctx.setLineWidth(1)
            var y = lineTopMargin
            while y < size.height - lineSpacing / 2 {
                ctx.move(to: CGPoint(x: 0, y: y))
                ctx.addLine(to: CGPoint(x: size.width, y: y))
                y += lineSpacing
            }
            ctx.strokePath()
            ctx.setStrokeColor(marginColor.cgColor)
            ctx.move(to: CGPoint(x: lineLeftMargin, y: 0))
            ctx.addLine(to: CGPoint(x: lineLeftMargin, y: size.height))
            ctx.strokePath()
        case .grid:
            ctx.setStrokeColor(gridColor.cgColor)
            ctx.setLineWidth(0.75)
            var x = gridSpacing
            while x < size.width {
                ctx.move(to: CGPoint(x: x, y: 0))
                ctx.addLine(to: CGPoint(x: x, y: size.height))
                x += gridSpacing
            }
            var y = gridSpacing
            while y < size.height {
                ctx.move(to: CGPoint(x: 0, y: y))
                ctx.addLine(to: CGPoint(x: size.width, y: y))
                y += gridSpacing
            }
            ctx.strokePath()
        case .dot:
            ctx.setFillColor(dotColor.cgColor)
            let radius: CGFloat = 1.3
            var y = gridSpacing
            while y < size.height {
                var x = gridSpacing
                while x < size.width {
                    ctx.fillEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                    x += gridSpacing
                }
                y += gridSpacing
            }
        case .blank, .pdf:
            break
        }
    }

    /// 다크 모드와 관계없이 원래 잉크 색으로 렌더링
    static func inkImage(_ drawing: PKDrawing, size: CGSize, scale: CGFloat) -> UIImage {
        var image = UIImage()
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            image = drawing.image(from: CGRect(origin: .zero, size: size), scale: scale)
        }
        return image
    }

    /// 배경 + 사진 + 필기를 합친 이미지
    static func composite(_ content: NotebookRenderContent, scale: CGFloat) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        let ink = inkImage(content.drawing, size: content.size, scale: scale)
        return UIGraphicsImageRenderer(size: content.size, format: format).image { _ in
            draw(content, ink: ink)
        }
    }

    private static func draw(_ content: NotebookRenderContent, ink: UIImage) {
        let rect = CGRect(origin: .zero, size: content.size)
        content.background.draw(in: rect)
        for photo in content.photos {
            photo.image.draw(in: photo.frame)
        }
        ink.draw(in: rect)
    }

    /// 목록·웹 보기용 미리보기 JPEG
    static func previewJPEG(_ content: NotebookRenderContent) -> Data? {
        composite(content, scale: 1.5).jpegData(compressionQuality: 0.75)
    }

    /// 여러 페이지를 PDF 하나로 (페이지마다 크기가 달라도 된다)
    static func pdfData(_ pages: [NotebookRenderContent]) -> Data {
        let firstBounds = CGRect(origin: .zero, size: pages.first?.size ?? NotebookPageLayout.defaultSize)
        return UIGraphicsPDFRenderer(bounds: firstBounds).pdfData { context in
            for page in pages {
                context.beginPage(withBounds: CGRect(origin: .zero, size: page.size), pageInfo: [:])
                draw(page, ink: inkImage(page.drawing, size: page.size, scale: 2))
            }
        }
    }
}
