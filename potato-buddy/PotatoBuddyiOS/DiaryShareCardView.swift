import SwiftUI
import UIKit

struct DiaryShareCardView: View {
    let diary: DiaryItem

    @Environment(\.dismiss) private var dismiss
    @State private var cardImage: UIImage?
    @State private var isLoading = true
    @State private var showShareSheet = false
    @State private var savedMessage = ""

    private var formattedDate: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "yyyy년 M월 d일"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: diary.date) else { return diary.date }
        return outFmt.string(from: d)
    }

    var body: some View {
        ZStack {
            SketchbookStyle.ink.opacity(0.72).ignoresSafeArea()

            VStack(spacing: 16) {
                HStack {
                    Text("일기 공유 카드").font(.system(size: 18)).foregroundStyle(SketchbookStyle.ink)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").foregroundStyle(SketchbookStyle.muted)
                    }
                }

                Group {
                    if isLoading {
                        ProgressView().frame(height: 300)
                    } else if let cardImage {
                        Image(uiImage: cardImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 420)
                            .shadow(radius: 8)
                    } else {
                        Text("카드를 만들지 못했습니다.").font(.system(size: 13)).foregroundStyle(SketchbookStyle.muted)
                    }
                }

                if !savedMessage.isEmpty {
                    Text(savedMessage).font(.system(size: 12)).foregroundStyle(SketchbookStyle.greenText)
                }

                HStack(spacing: 9) {
                    Button {
                        saveToPhotos()
                    } label: {
                        Text("이미지 저장")
                            .padding(.horizontal, 20).padding(.vertical, 10)
                            .foregroundStyle(SketchbookStyle.ink)
                            .background(SketchbookStyle.paper)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .disabled(cardImage == nil)

                    Button {
                        showShareSheet = true
                    } label: {
                        Text("인스타 공유")
                            .padding(.horizontal, 20).padding(.vertical, 10)
                            .foregroundStyle(.white)
                            .background(SketchbookStyle.green)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .disabled(cardImage == nil)
                }
            }
            .padding(20)
        }
        .task { await composeCard() }
        .sheet(isPresented: $showShareSheet) {
            if let cardImage {
                ActivityShareSheet(items: [cardImage])
            }
        }
    }

    private func composeCard() async {
        isLoading = true
        var sourceImage: UIImage?
        if let urlString = diary.thumbnailUrl, let url = URL(string: urlString),
           let (data, _) = try? await URLSession.shared.data(from: url) {
            sourceImage = UIImage(data: data)
        }
        cardImage = DiarySketchImageComposer.composeShareCard(
            image: sourceImage,
            dateLabel: formattedDate,
            emotionLabel: DiaryEmotionLabels.label(for: diary.emotion)
        )
        isLoading = false
    }

    private func saveToPhotos() {
        guard let cardImage else { return }
        UIImageWriteToSavedPhotosAlbum(cardImage, nil, nil, nil)
        savedMessage = "사진 앱에 저장했어요."
    }
}
