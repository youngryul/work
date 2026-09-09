import SwiftUI
import UIKit

struct DiaryFourCutViewerView: View {
    let diary: DiaryItem

    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?
    @State private var isLoading = true
    @State private var showShareSheet = false
    @State private var savedMessage = ""

    var body: some View {
        ZStack {
            SketchbookStyle.ink.opacity(0.72).ignoresSafeArea()

            VStack(spacing: 16) {
                HStack {
                    Text("4컷 그림일기").font(.system(size: 21)).foregroundStyle(SketchbookStyle.ink)
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(SketchbookStyle.muted)
                    }
                }

                Group {
                    if isLoading {
                        ProgressView().frame(height: 240)
                    } else if let image {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 420)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                    } else {
                        Text("이미지를 불러오지 못했습니다.")
                            .font(.system(size: 13))
                            .foregroundStyle(SketchbookStyle.muted)
                    }
                }

                if !savedMessage.isEmpty {
                    Text(savedMessage).font(.system(size: 12)).foregroundStyle(SketchbookStyle.greenText)
                }

                HStack(spacing: 8) {
                    Button {
                        saveToPhotos()
                    } label: {
                        Text("저장")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .foregroundStyle(SketchbookStyle.ink)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .disabled(image == nil)

                    Button {
                        showShareSheet = true
                    } label: {
                        Text("공유")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .foregroundStyle(.white)
                            .background(SketchbookStyle.green)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                    .buttonStyle(.plain)
                    .disabled(image == nil)
                }
            }
            .padding(18)
            .background(SketchbookStyle.paper)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(SketchbookStyle.ink, lineWidth: 3))
            .padding(24)
        }
        .task { await loadImage() }
        .sheet(isPresented: $showShareSheet) {
            if let image {
                ActivityShareSheet(items: [image])
            }
        }
    }

    private func loadImage() async {
        isLoading = true
        if let urlString = diary.fourCutUrl, let url = URL(string: urlString) {
            if let (data, _) = try? await URLSession.shared.data(from: url), let uiImage = UIImage(data: data) {
                image = uiImage
            }
        }
        isLoading = false
    }

    private func saveToPhotos() {
        guard let image else { return }
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        savedMessage = "사진 앱에 저장했어요."
    }
}
