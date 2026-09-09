import UIKit

/// `SupabaseService`의 4컷 관련 메서드는 Shared(macOS 타겟과도 공유)에 있어 UIKit을 쓸 수 없다.
/// 스트립 이미지 합성(`DiarySketchImageComposer`, UIKit 필요)을 곁들인 편의 메서드를 iOS 전용으로 추가한다.
extension SupabaseService {

    /// AI 4컷: 장면 생성 → 스트립 합성 → 저장까지 한 번에 수행한다.
    func generateFourCutDiary(
        date: String, content: String, existingCoverImageUrl: String?,
        onProgress: @escaping (Int, Int) -> Void
    ) async throws -> (item: DiaryItem, tokensUsed: Int, awarded: Int) {
        let (sceneUrls, tokenCost) = try await generateFourCutSceneUrls(date: date, content: content, onProgress: onProgress)

        let images = try await Self.downloadImages(urls: sceneUrls)
        let strip = DiarySketchImageComposer.composeFourCutStrip(images: images, dateLabel: date)
        let stripData = strip.pngData() ?? Data()
        let timestamp = Int(Date().timeIntervalSince1970)
        let stripUrl = try await uploadImageData(stripData, folder: "diaries", fileName: "\(date)-fourcut-\(timestamp).png")

        let (item, awarded) = try await finalizeFourCutDiary(
            date: date, content: content,
            sceneUrls: sceneUrls, stripUrl: stripUrl,
            existingCoverImageUrl: existingCoverImageUrl
        )
        return (item, tokenCost, awarded)
    }

    /// 사진 4컷: 사용자가 고른 1~4장의 사진 업로드 → 스트립 합성 → 저장까지 한 번에 수행한다. 토큰을 쓰지 않는다.
    func savePhotoFourCutDiary(
        date: String, content: String, photos: [Data], existingCoverImageUrl: String?
    ) async throws -> (item: DiaryItem, awarded: Int) {
        let photoUrls = try await uploadPhotoFourCutSources(date: date, photos: photos)

        let images = photos.prefix(4).compactMap { UIImage(data: $0) }
        let strip = DiarySketchImageComposer.composeFourCutStrip(images: images, dateLabel: date)
        let stripData = strip.pngData() ?? Data()
        let timestamp = Int(Date().timeIntervalSince1970)
        let stripUrl = try await uploadImageData(stripData, folder: "diaries", fileName: "\(date)-fourcut-\(timestamp).png")

        return try await finalizeFourCutDiary(
            date: date, content: content,
            sceneUrls: photoUrls, stripUrl: stripUrl,
            attachedImages: photoUrls,
            existingCoverImageUrl: existingCoverImageUrl
        )
    }

    private static func downloadImages(urls: [String]) async throws -> [UIImage] {
        var images: [UIImage] = []
        for urlString in urls {
            guard let url = URL(string: urlString) else { continue }
            let (data, _) = try await URLSession.shared.data(from: url)
            if let image = UIImage(data: data) {
                images.append(image)
            }
        }
        return images
    }
}
