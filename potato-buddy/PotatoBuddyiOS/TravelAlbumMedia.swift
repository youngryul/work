import ImageIO
import Photos
import UIKit

/// 여행 앨범 사진 로더. 원본 데이터를 메모리에 캐시하고, 화면용은 축소본을 만든다.
actor TravelAlbumImageLoader {
    static let shared = TravelAlbumImageLoader()

    private var dataCache: [String: Data] = [:]

    /// 원본 이미지 데이터
    func loadData(for urlString: String) async throws -> Data {
        if let cached = dataCache[urlString] { return cached }
        guard let url = URL(string: urlString) else { throw URLError(.badURL) }
        let (data, _) = try await URLSession.shared.data(from: url)
        dataCache[urlString] = data
        return data
    }

    /// 긴 변이 maxPixel 이하인 축소본 (EXIF 회전 반영)
    func thumbnail(for urlString: String, maxPixel: CGFloat = 1200) async -> UIImage? {
        guard let data = try? await loadData(for: urlString) else { return nil }
        return Self.downsample(data, maxPixel: maxPixel)
    }

    /// 원본 해상도 이미지
    func fullImage(for urlString: String) async -> UIImage? {
        guard let data = try? await loadData(for: urlString) else { return nil }
        return UIImage(data: data)
    }

    private static func downsample(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ] as CFDictionary
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else {
            return UIImage(data: data)
        }
        return UIImage(cgImage: cgImage)
    }
}

/// 사진 앱 저장 · 인스타그램 공유
enum TravelAlbumPhotoExporter {

    enum ExportError: LocalizedError {
        case permissionDenied
        case saveFailed

        var errorDescription: String? {
            switch self {
            case .permissionDenied:
                return "사진 앱 접근 권한이 없어요. 설정 > 포실이 > 사진에서 '사진 추가'를 허용해 주세요."
            case .saveFailed:
                return "사진 앱에 저장하지 못했어요."
            }
        }
    }

    /// 사진 앱에 저장하고 저장된 에셋의 localIdentifier를 돌려준다.
    @discardableResult
    static func saveToPhotos(_ image: UIImage) async throws -> String {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw ExportError.permissionDenied
        }

        // performChanges 클로저 안에서 값을 받아오기 위한 상자 (캡처한 var 변경 불가)
        let box = IdentifierBox()
        try await PHPhotoLibrary.shared().performChanges {
            let request = PHAssetChangeRequest.creationRequestForAsset(from: image)
            box.value = request.placeholderForCreatedAsset?.localIdentifier
        }
        guard let identifier = box.value else { throw ExportError.saveFailed }
        return identifier
    }

    private final class IdentifierBox: @unchecked Sendable {
        var value: String?
    }

    /// 사진 앱에 저장한 뒤 인스타그램 새 게시물 화면으로 연다.
    /// 인스타그램이 없거나 열리지 않으면 false (호출 측에서 공유 시트로 대체).
    @MainActor
    static func shareToInstagram(_ image: UIImage) async throws -> Bool {
        let identifier = try await saveToPhotos(image)
        guard let encoded = identifier.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "instagram://library?LocalIdentifier=\(encoded)") else {
            return false
        }
        return await UIApplication.shared.open(url)
    }
}
