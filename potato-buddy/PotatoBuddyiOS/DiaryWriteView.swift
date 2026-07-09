import SwiftUI

struct DiaryWriteView: View {
    let date: String
    let existingDiary: DiaryItem?

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var jellyStore: JellyBalanceStore
    @State private var content: String = ""
    @State private var isSaving: Bool = false
    @State private var errorMessage: String = ""
    @State private var jellyEarnedMessage: String = ""

    // 감정 한글 매핑
    private let emotionLabels: [String: String] = [
        "calm": "평온", "comfort": "편안", "happiness": "행복",
        "sadness": "슬픔", "anxiety": "불안", "loneliness": "외로움",
        "hope": "희망", "tiredness": "피곤", "excitement": "설렘",
        "gratitude": "감사", "nostalgia": "그리움", "frustration": "답답",
        "relief": "안도", "pride": "뿌듯함", "embarrassment": "부끄러움",
        "envy": "부러움", "determination": "의지", "confusion": "혼란",
        "peace": "평화", "love": "사랑", "anger": "화남",
        "disappointment": "실망", "satisfaction": "만족"
    ]

    init(date: String, existingDiary: DiaryItem?) {
        self.date = date
        self.existingDiary = existingDiary
        _content = State(initialValue: existingDiary?.content ?? "")
    }

    private var formattedDate: String {
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        let outputFormatter = DateFormatter()
        outputFormatter.dateFormat = "yyyy년 MM월 dd일"
        outputFormatter.locale = Locale(identifier: "ko_KR")
        if let d = inputFormatter.date(from: date) {
            return outputFormatter.string(from: d)
        }
        return date
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // 날짜 헤더
                    Text(formattedDate)
                        .font(.title2)
                        .fontWeight(.bold)
                        .padding(.horizontal)
                        .padding(.top, 8)

                    // 이미지 (있을 때만 표시)
                    if let imageUrlString = existingDiary?.imageUrl,
                       let imageUrl = URL(string: imageUrlString) {
                        AsyncImage(url: imageUrl) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 200)
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFill()
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 220)
                                    .clipped()
                                    .cornerRadius(12)
                                    .padding(.horizontal)
                            case .failure:
                                EmptyView()
                            @unknown default:
                                EmptyView()
                            }
                        }
                    }

                    // 일기 내용 입력
                    TextEditor(text: $content)
                        .frame(minHeight: 300)
                        .padding(8)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .padding(.horizontal)

                    // 감정 표시 (있을 때만)
                    if let emotion = existingDiary?.emotion,
                       let label = emotionLabels[emotion] {
                        HStack {
                            Text("오늘의 감정:")
                                .foregroundColor(.secondary)
                            Text(label)
                                .fontWeight(.semibold)
                                .foregroundColor(.green)
                        }
                        .font(.subheadline)
                        .padding(.horizontal)
                    }

                    // 에러 메시지
                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.footnote)
                            .padding(.horizontal)
                    }
                }
                .padding(.bottom, 32)
            }
            .navigationTitle(existingDiary == nil ? "일기 쓰기" : "일기 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("닫기") {
                        dismiss()
                    }
                    .foregroundColor(.secondary)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("저장")
                                .fontWeight(.semibold)
                                .foregroundColor(.green)
                        }
                    }
                    .disabled(isSaving || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .alert("젤리 획득", isPresented: Binding(get: { !jellyEarnedMessage.isEmpty }, set: { _ in jellyEarnedMessage = "" })) {
                Button("확인") {
                    jellyEarnedMessage = ""
                    dismiss()
                }
            } message: {
                Text(jellyEarnedMessage)
            }
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = ""
        do {
            let result = try await SupabaseService.shared.saveDiary(date: date, content: content)
            if result.awarded > 0 {
                jellyEarnedMessage = "젤리 +\(result.awarded)을 획득했어요."
                await jellyStore.refresh()
            } else {
                dismiss()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
