import SwiftUI

private enum ToeicStudyMode: String, CaseIterable, Identifiable {
    case list
    case flash
    case challenge

    var id: String { rawValue }

    var label: String {
        switch self {
        case .list: return "전체 목록"
        case .flash: return "플래시카드"
        case .challenge: return "완료 기록"
        }
    }
}

struct ToeicVocabView: View {
    private let vocab = ToeicVocabRepository.shared.data

    @StateObject private var completionModel = ToeicCompletionViewModel()
    @State private var studyMode: ToeicStudyMode = .list
    @State private var selectedDay: Int = 1
    @State private var flashIndex = 0
    @State private var isFlipped = false
    @State private var flashOrder: [Int] = []
    @State private var showKoreanFirst = false

    private var dayData: ToeicVocabDay? {
        vocab.days.first { $0.day == selectedDay } ?? vocab.days.first
    }

    private var words: [ToeicVocabWord] {
        dayData?.words ?? []
    }

    private var currentWord: ToeicVocabWord? {
        guard !flashOrder.isEmpty, flashIndex < flashOrder.count else { return nil }
        let wordIndex = flashOrder[flashIndex]
        guard wordIndex < words.count else { return nil }
        return words[wordIndex]
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerSection
                    modePicker

                    if studyMode != .challenge {
                        dayPickerSection
                    }

                    switch studyMode {
                    case .list:
                        wordListSection
                    case .flash:
                        flashcardSection
                    case .challenge:
                        ToeicDayChallengeGridView(
                            dayCount: vocab.dayCount,
                            selectedDay: selectedDay,
                            onSelectDay: selectDay,
                            completionModel: completionModel
                        )
                    }
                }
                .padding()
            }
            .navigationTitle("토익 단어")
            .navigationBarTitleDisplayMode(.large)
            .task {
                if selectedDay == 1 {
                    selectedDay = ToeicVocabLocalStore.loadSelectedDay(maxDay: max(vocab.dayCount, 1))
                }
                resetFlashOrder()
                await completionModel.load()
            }
            .onChange(of: selectedDay) { _, newValue in
                ToeicVocabLocalStore.saveSelectedDay(newValue)
                resetFlashOrder()
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("노랭이 단어모음 · 총 \(vocab.wordCount.formatted())단어")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text("DAY당 \(ToeicVocabData.wordsPerDay)개 · DAY 1–\(vocab.dayCount)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var modePicker: some View {
        Picker("학습 모드", selection: $studyMode) {
            ForEach(ToeicStudyMode.allCases) { mode in
                Text(mode.label).tag(mode)
            }
        }
        .pickerStyle(.segmented)
    }

    private var dayPickerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Day 선택")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("DAY \(selectedDay) · \(words.count)단어")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 36), spacing: 6)], spacing: 6) {
                ForEach(vocab.days) { day in
                    Button {
                        selectDay(day.day)
                    } label: {
                        Text("\(day.day)")
                            .font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 32)
                            .background(day.day == selectedDay ? Color.cyan : Color.white)
                            .foregroundColor(day.day == selectedDay ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.cyan.opacity(0.3), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxHeight: 160)
        }
    }

    private var wordListSection: some View {
        VStack(spacing: 0) {
            HStack {
                Text("#").frame(width: 28, alignment: .leading)
                Text("English").frame(maxWidth: .infinity, alignment: .leading)
                Text("한글").frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(.caption.weight(.semibold))
            .foregroundColor(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.cyan.opacity(0.12))

            ForEach(Array(words.enumerated()), id: \.element.id) { index, word in
                HStack(alignment: .top) {
                    Text("\(index + 1)")
                        .frame(width: 28, alignment: .leading)
                        .foregroundColor(.secondary)
                    Text(word.en)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fontWeight(.medium)
                    Text(word.ko)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundColor(.secondary)
                }
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                Divider()
            }
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cyan.opacity(0.2)))
    }

    @ViewBuilder
    private var flashcardSection: some View {
        if words.isEmpty {
            Text("이 Day에 단어가 없습니다.")
                .foregroundColor(.secondary)
        } else if let word = currentWord {
            VStack(spacing: 12) {
                HStack {
                    Text("\(flashIndex + 1) / \(flashOrder.count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Button(showKoreanFirst ? "한글 → 영어" : "영어 → 한글") {
                        showKoreanFirst.toggle()
                        isFlipped = false
                    }
                    .font(.caption)
                    Button("섞기") {
                        shuffleFlash()
                    }
                    .font(.caption)
                }

                Button {
                    handleCardTap()
                } label: {
                    VStack(spacing: 8) {
                        Text(isFlipped ? "뜻 · 탭하면 다음" : "단어 · 탭하면 뜻")
                            .font(.caption)
                            .foregroundColor(.cyan)
                        Text(displayText(word: word, flipped: isFlipped))
                            .font(.title2.bold())
                            .multilineTextAlignment(.center)
                            .foregroundColor(.primary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 200)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan.opacity(0.35), lineWidth: 2))
                }
                .buttonStyle(.plain)

                HStack(spacing: 16) {
                    Button("이전") { goPrev() }
                    Button("다음") { goNext() }
                }
                .buttonStyle(.bordered)

                ProgressView(value: Double(flashIndex + 1), total: Double(max(flashOrder.count, 1)))
                    .tint(.cyan)
            }
            .padding()
            .background(Color.cyan.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func selectDay(_ day: Int) {
        selectedDay = day
    }

    private func resetFlashOrder() {
        flashOrder = Array(words.indices)
        flashIndex = 0
        isFlipped = false
    }

    private func shuffleFlash() {
        flashOrder.shuffle()
        flashIndex = 0
        isFlipped = false
    }

    private func displayText(word: ToeicVocabWord, flipped: Bool) -> String {
        let front = showKoreanFirst ? word.ko : word.en
        let back = showKoreanFirst ? word.en : word.ko
        return flipped ? back : front
    }

    private func handleCardTap() {
        if !isFlipped {
            isFlipped = true
            return
        }
        isFlipped = false
        goNext()
    }

    private func goPrev() {
        isFlipped = false
        guard !flashOrder.isEmpty else { return }
        flashIndex = flashIndex <= 0 ? flashOrder.count - 1 : flashIndex - 1
    }

    private func goNext() {
        isFlipped = false
        guard !flashOrder.isEmpty else { return }
        flashIndex = flashIndex >= flashOrder.count - 1 ? 0 : flashIndex + 1
    }
}
