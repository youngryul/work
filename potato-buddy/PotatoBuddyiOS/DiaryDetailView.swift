import SwiftUI

struct DiaryDetailView: View {
    let diary: DiaryItem
    var onBack: () -> Void
    var onEdit: () -> Void
    var onPrevDay: () -> Void
    var onNextDay: () -> Void
    var onCoverUpdated: (DiaryItem) -> Void

    @State private var showFourCutViewer = false
    @State private var showShareCard = false
    @State private var isUpdatingCover = false
    @State private var errorMessage = ""

    private var formattedDate: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "M월 d일"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: diary.date) else { return diary.date }
        return outFmt.string(from: d)
    }

    private var dayName: String {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "EEEE"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: diary.date) else { return "" }
        return outFmt.string(from: d)
    }

    private var adjacentLabel: (prev: String, next: String) {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        let outFmt = DateFormatter()
        outFmt.dateFormat = "M월 d일"
        outFmt.locale = Locale(identifier: "ko_KR")
        guard let d = inFmt.date(from: diary.date) else { return ("이전", "다음") }
        let cal = Calendar(identifier: .gregorian)
        let prev = cal.date(byAdding: .day, value: -1, to: d).map { outFmt.string(from: $0) } ?? "이전"
        let next = cal.date(byAdding: .day, value: 1, to: d).map { outFmt.string(from: $0) } ?? "다음"
        return (prev, next)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Button("‹ 달력") { onBack() }
                        .foregroundStyle(SketchbookStyle.ink)
                    Spacer()
                    HStack(spacing: 8) {
                        Button("공유") { showShareCard = true }
                            .font(.system(size: 13))
                            .foregroundStyle(SketchbookStyle.ink)
                            .padding(.horizontal, 12).padding(.vertical, 5)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                        Button("고치기") { onEdit() }
                            .font(.system(size: 13))
                            .foregroundStyle(SketchbookStyle.ink)
                            .padding(.horizontal, 12).padding(.vertical, 5)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(SketchbookStyle.ink, lineWidth: 2))
                            .clipShape(RoundedRectangle(cornerRadius: 5))
                    }
                }
                .font(.system(size: 15))
                .padding(.bottom, 12)

                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .lastTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(formattedDate).font(.sketchbook(24)).foregroundStyle(SketchbookStyle.ink)
                            Text("\(dayName) · \(DiaryEmotionLabels.label(for: diary.emotion))")
                                .font(.system(size: 13))
                                .foregroundStyle(SketchbookStyle.muted)
                        }
                        Spacer()
                        EmotionStampView(emotion: DiaryEmotionLabels.label(for: diary.emotion), rotation: 5)
                    }
                    .padding(.bottom, 8)
                    Rectangle().fill(SketchbookStyle.ink).frame(height: 2)
                        .padding(.bottom, 14)

                    coverImageView
                        .padding(.bottom, 9)

                    if diary.hasFourCut {
                        Button {
                            showFourCutViewer = true
                        } label: {
                            HStack(spacing: 7) {
                                Text("4컷 전체 보기 →").font(.system(size: 14))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .foregroundStyle(SketchbookStyle.ink)
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(SketchbookStyle.ink.opacity(0.45), style: StrokeStyle(lineWidth: 2, dash: [4, 4])))
                        }
                        .buttonStyle(.plain)
                        .padding(.bottom, 12)
                    }

                    if diary.coverCandidates.count > 1 {
                        coverCandidatePicker
                            .padding(.bottom, 12)
                    }

                    Text(diary.content)
                        .font(.system(size: 17))
                        .foregroundStyle(SketchbookStyle.ink)
                        .lineSpacing(6)
                }
                .padding(16)
                .background(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(SketchbookStyle.ink, lineWidth: 3))

                if !errorMessage.isEmpty {
                    Text(errorMessage).font(.system(size: 13)).foregroundStyle(.red).padding(.top, 8)
                }

                HStack {
                    Button("‹ \(adjacentLabel.prev)") { onPrevDay() }
                        .foregroundStyle(SketchbookStyle.muted)
                    Spacer()
                    Button("\(adjacentLabel.next) ›") { onNextDay() }
                        .foregroundStyle(SketchbookStyle.muted)
                }
                .font(.system(size: 14))
                .padding(.top, 16)
                .padding(.bottom, 30)
            }
            .padding(.horizontal, 18)
            .padding(.top, 36)
        }
        .sheet(isPresented: $showFourCutViewer) {
            DiaryFourCutViewerView(diary: diary)
        }
        .sheet(isPresented: $showShareCard) {
            DiaryShareCardView(diary: diary)
        }
    }

    private var coverImageView: some View {
        ZStack {
            Color(red: 0.93, green: 0.96, blue: 0.97)
            if let urlString = diary.thumbnailUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    }
                }
                .clipped()
            } else {
                Text("대문 그림").font(.system(size: 10, design: .monospaced)).foregroundStyle(.black.opacity(0.4))
            }
        }
        .aspectRatio(4.0 / 3.0, contentMode: .fit)
        .clipped()
        .overlay(RoundedRectangle(cornerRadius: 0).stroke(SketchbookStyle.ink, lineWidth: 2))
    }

    private var coverCandidatePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("대문 사진 선택").font(.system(size: 12)).foregroundStyle(SketchbookStyle.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(diary.coverCandidates, id: \.self) { candidate in
                        Button {
                            Task { await updateCover(candidate) }
                        } label: {
                            AsyncImage(url: URL(string: candidate)) { phase in
                                if case .success(let image) = phase {
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } else {
                                    Color(white: 0.9)
                                }
                            }
                            .frame(width: 56, height: 56)
                            .clipped()
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(candidate == diary.thumbnailUrl ? SketchbookStyle.greenDark : Color.black.opacity(0.15), lineWidth: candidate == diary.thumbnailUrl ? 2.5 : 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isUpdatingCover)
                    }
                }
            }
        }
    }

    private func updateCover(_ url: String) async {
        isUpdatingCover = true
        errorMessage = ""
        do {
            let updated = try await SupabaseService.shared.updateDiaryCoverImage(date: diary.date, coverImageUrl: url)
            onCoverUpdated(updated)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isUpdatingCover = false
    }
}
