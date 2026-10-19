import SwiftUI
import UIKit

/// 앨범 전체를 폴라로이드 콜라주 한 장으로 만들어 저장·인스타그램·공유
struct TravelAlbumShareView: View {
    let album: TravelAlbum
    let photos: [TravelAlbumPhoto]

    @Environment(\.dismiss) private var dismiss
    @State private var collage: UIImage?
    @State private var isLoading = true
    @State private var isWorking = false
    @State private var shareItem: TravelAlbumShareItem?
    @State private var message = ""
    @State private var isError = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                ScrollView {
                    Group {
                        if isLoading {
                            ProgressView("앨범 이미지 만드는 중...")
                                .frame(maxWidth: .infinity, minHeight: 320)
                        } else if let collage {
                            Image(uiImage: collage)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
                        } else {
                            Text("앨범 이미지를 만들지 못했어요.")
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, minHeight: 320)
                        }
                    }
                    .padding(16)

                    Text("사진 \(photos.count)장과 한줄 메모가 한 장의 이미지로 저장돼요.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if !message.isEmpty {
                    Text(message)
                        .font(.footnote)
                        .foregroundColor(isError ? .red : .green)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }

                VStack(spacing: 10) {
                    Button {
                        Task { await shareToInstagram() }
                    } label: {
                        Label("인스타그램에 올리기", systemImage: "camera.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.pink)

                    HStack(spacing: 10) {
                        Button {
                            Task { await save() }
                        } label: {
                            Label("이미지 저장", systemImage: "square.and.arrow.down")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.bordered)
                        .tint(.pink)

                        Button {
                            if let collage { shareItem = TravelAlbumShareItem(image: collage) }
                        } label: {
                            Label("공유하기", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.bordered)
                        .tint(.pink)
                    }
                }
                .disabled(collage == nil || isWorking)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
            .navigationTitle("앨범 이미지 저장 · 공유")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("닫기") { dismiss() }
                }
            }
        }
        .task { await composeCollage() }
        .sheet(item: $shareItem) { item in
            ActivityShareSheet(items: [item.image])
        }
    }

    private func composeCollage() async {
        isLoading = true
        defer { isLoading = false }
        // 사진을 병렬로 받아 원래 순서대로 합성
        let images = await withTaskGroup(of: (Int, UIImage?).self) { group in
            for (index, photo) in photos.enumerated() {
                group.addTask {
                    (index, await TravelAlbumImageLoader.shared.thumbnail(for: photo.imageUrl, maxPixel: 1080))
                }
            }
            var result = [UIImage?](repeating: nil, count: photos.count)
            for await (index, image) in group { result[index] = image }
            return result
        }
        let items = zip(photos, images).map { photo, image in
            TravelAlbumImageComposer.Item(image: image, caption: photo.trimmedCaption)
        }
        collage = TravelAlbumImageComposer.compose(title: album.title, periodLabel: album.periodLabel, items: items)
    }

    private func save() async {
        guard let collage else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            try await TravelAlbumPhotoExporter.saveToPhotos(collage)
            show("사진 앱에 저장했어요.")
        } catch {
            show(error.localizedDescription, error: true)
        }
    }

    private func shareToInstagram() async {
        guard let collage else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            let opened = try await TravelAlbumPhotoExporter.shareToInstagram(collage)
            if !opened {
                // 인스타그램이 없으면 공유 시트로 대체 (사진 앱에는 이미 저장됨)
                show("인스타그램을 열 수 없어 공유 시트를 띄웠어요. 사진 앱에도 저장했어요.")
                shareItem = TravelAlbumShareItem(image: collage)
            }
        } catch {
            show(error.localizedDescription, error: true)
        }
    }

    private func show(_ text: String, error: Bool = false) {
        message = text
        isError = error
    }
}
