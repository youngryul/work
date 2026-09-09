import SwiftUI

/// 그림일기 감정 영문 키 → 한글 라벨. 여러 화면(작성/상세/공유카드)에서 공유한다.
enum DiaryEmotionLabels {
    static let map: [String: String] = [
        "calm": "평온", "comfort": "편안", "happiness": "행복",
        "sadness": "슬픔", "anxiety": "불안", "loneliness": "외로움",
        "hope": "희망", "tiredness": "피곤", "excitement": "설렘",
        "gratitude": "감사", "nostalgia": "그리움", "frustration": "답답",
        "relief": "안도", "pride": "뿌듯함", "embarrassment": "부끄러움",
        "envy": "부러움", "determination": "의지", "confusion": "혼란",
        "peace": "평화", "love": "사랑", "anger": "화남",
        "disappointment": "실망", "satisfaction": "만족",
    ]

    static func label(for key: String?) -> String {
        guard let key, let label = map[key] else { return "오늘의 기록" }
        return label
    }
}

/// 그림일기 탭 루트. Sketchbook 디자인 하나의 도화지 위에서 달력→작성→상세 화면을 상태로 전환한다.
struct DiaryCalendarView: View {
    private enum Screen {
        case calendar
        case write(date: String, existing: DiaryItem?)
        case detail(date: String)
    }

    @State private var screen: Screen = .calendar
    @State private var monthAnchor: Date = Date()
    @State private var diariesByDate: [String: DiaryItem] = [:]
    @State private var isLoading = false
    @State private var errorMessage = ""

    private let calendar = Calendar(identifier: .gregorian)

    private static let isoDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private var todayDateString: String { Self.isoDateFormatter.string(from: Date()) }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                SketchbookStyle.outerBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        SketchbookPaperBackground()

                        switch screen {
                        case .calendar:
                            calendarScreen
                        case .write(let date, let existing):
                            DiaryWriteView(
                                date: date,
                                existingDiary: existing,
                                onCancel: { screen = existing == nil ? .calendar : .detail(date: date) },
                                onSaved: { saved in
                                    diariesByDate[saved.date] = saved
                                    screen = .detail(date: saved.date)
                                }
                            )
                        case .detail(let date):
                            if let diary = diariesByDate[date] {
                                DiaryDetailView(
                                    diary: diary,
                                    onBack: { screen = .calendar },
                                    onEdit: { screen = .write(date: date, existing: diary) },
                                    onPrevDay: { moveDay(from: date, by: -1) },
                                    onNextDay: { moveDay(from: date, by: 1) },
                                    onCoverUpdated: { updated in diariesByDate[updated.date] = updated }
                                )
                            }
                        }

                        SketchbookRingBinding()
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 26))
                    .shadow(color: SketchbookStyle.hardShadow, radius: 24, y: 12)
                    .frame(maxWidth: 480)
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .frame(maxHeight: .infinity)
                }
            }
        }
        .task { await loadDiaries() }
        .alert("오류", isPresented: Binding(get: { !errorMessage.isEmpty }, set: { _ in errorMessage = "" })) {
            Button("확인") { errorMessage = "" }
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - 달력 화면

    private var calendarScreen: some View {
        VStack(spacing: 0) {
            HStack(alignment: .lastTextBaseline) {
                Text("그림일기")
                    .font(.sketchbook(34))
                    .foregroundStyle(SketchbookStyle.ink)
                Spacer()
                Text("\(daysInMonth) 일 중 \(daysWithDiaryCount) 일")
                    .font(.system(size: 13))
                    .foregroundStyle(SketchbookStyle.muted)
            }
            SketchUnderline()
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, -4)
                .padding(.bottom, 12)

            HStack {
                monthNavButton(systemImage: "chevron.left") { changeMonth(by: -1) }
                Spacer()
                Text(monthTitle)
                    .font(.system(size: 23))
                    .foregroundStyle(SketchbookStyle.ink)
                Spacer()
                monthNavButton(systemImage: "chevron.right") { changeMonth(by: 1) }
            }
            .padding(.bottom, 10)

            HStack(spacing: 0) {
                ForEach(Array(weekdaySymbols.enumerated()), id: \.offset) { index, symbol in
                    Text(symbol)
                        .font(.system(size: 13))
                        .foregroundStyle(index == 0 ? Color(red: 0.79, green: 0.55, blue: 0.55) : index == 6 ? Color(red: 0.55, green: 0.65, blue: 0.79) : SketchbookStyle.muted)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 6)

            if isLoading && diariesByDate.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 7), spacing: 6) {
                    ForEach(monthCells) { cell in
                        dayCell(cell)
                    }
                }
            }

            Spacer(minLength: 8)

            VStack(spacing: 14) {
                HStack(spacing: 14) {
                    Text("AI 1컷 · \(countByKind(.oneCut))")
                    Text("AI 4컷 · \(countByKind(.aiFourCut))")
                    Text("사진 4컷 · \(countByKind(.photoFourCut))")
                }
                .font(.system(size: 12))
                .foregroundStyle(SketchbookStyle.muted)

                Button {
                    openWrite(date: todayDateString, existing: diariesByDate[todayDateString])
                } label: {
                    HStack(spacing: 8) {
                        Text("✎").font(.system(size: 18))
                        Text("오늘 그림일기 그리기").font(.sketchbook(20))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .foregroundStyle(.white)
                    .background(SketchbookStyle.green)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(SketchbookStyle.ink, lineWidth: 2.5))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 26)
        }
        .padding(.horizontal, 18)
        .padding(.top, 40)
        .refreshable { await loadDiaries() }
    }

    private func monthNavButton(systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(SketchbookStyle.ink)
                .frame(width: 34, height: 34)
                .background(Circle().fill(.white))
                .overlay(Circle().stroke(SketchbookStyle.ink, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    private func dayCell(_ cell: DayCell) -> some View {
        Button {
            guard let day = cell.day else { return }
            let dateString = cell.dateString ?? ""
            if diariesByDate[dateString] != nil {
                screen = .detail(date: dateString)
            } else {
                openWrite(date: dateString, existing: nil)
            }
            _ = day
        } label: {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(cell.diary != nil ? Color.white : Color.white.opacity(0.4))
                if let urlString = cell.diary?.thumbnailUrl, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image.resizable().aspectRatio(contentMode: .fill)
                        }
                    }
                    .clipped()
                }
                if let day = cell.day {
                    Text("\(day)")
                        .font(.system(size: 11))
                        .foregroundStyle(cell.diary != nil ? SketchbookStyle.ink : SketchbookStyle.mutedLight)
                        .padding(3)
                }
                if cell.isToday {
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(SketchbookStyle.greenDark, lineWidth: 2.5)
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .overlay(
                RoundedRectangle(cornerRadius: 2)
                    .stroke(cell.diary != nil ? SketchbookStyle.ink : Color.black.opacity(0.18), style: StrokeStyle(lineWidth: cell.diary != nil ? 2 : 1.5, dash: cell.diary != nil ? [] : [3, 3]))
            )
            .rotationEffect(.degrees(cell.tilt))
        }
        .buttonStyle(.plain)
        .disabled(cell.day == nil)
        .opacity(cell.day == nil ? 0 : 1)
    }

    // MARK: - 데이터

    private enum DiaryKind { case oneCut, aiFourCut, photoFourCut }

    private func countByKind(_ kind: DiaryKind) -> Int {
        diariesByDate.values.filter { item in
            switch kind {
            case .oneCut: return !item.hasFourCut && item.imageUrl != nil
            case .aiFourCut: return item.hasFourCut && !item.isPhotoFourCut
            case .photoFourCut: return item.isPhotoFourCut
            }
        }.count
    }

    private struct DayCell: Identifiable {
        let id: Int
        let day: Int?
        let dateString: String?
        let diary: DiaryItem?
        let isToday: Bool
        let tilt: Double
    }

    private var monthTitle: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy년 M월"
        f.locale = Locale(identifier: "ko_KR")
        return f.string(from: monthAnchor)
    }

    private var weekdaySymbols: [String] { ["일", "월", "화", "수", "목", "금", "토"] }

    private var daysInMonth: Int {
        calendar.range(of: .day, in: .month, for: monthAnchor)?.count ?? 30
    }

    private var daysWithDiaryCount: Int {
        let comps = calendar.dateComponents([.year, .month], from: monthAnchor)
        return diariesByDate.keys.filter { key in
            guard let date = Self.isoDateFormatter.date(from: key) else { return false }
            let c = calendar.dateComponents([.year, .month], from: date)
            return c.year == comps.year && c.month == comps.month
        }.count
    }

    private var monthCells: [DayCell] {
        var comps = calendar.dateComponents([.year, .month], from: monthAnchor)
        comps.day = 1
        guard let firstOfMonth = calendar.date(from: comps) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: firstOfMonth) - 1 // 0 = 일요일
        let total = daysInMonth
        let todayString = todayDateString

        var cells: [DayCell] = []
        for i in 0..<firstWeekday {
            cells.append(DayCell(id: -1 - i, day: nil, dateString: nil, diary: nil, isToday: false, tilt: 0))
        }
        for day in 1...total {
            var dc = comps
            dc.day = day
            let date = calendar.date(from: dc) ?? firstOfMonth
            let dateString = Self.isoDateFormatter.string(from: date)
            let diary = diariesByDate[dateString]
            let tilt = Double((day * 37) % 5 - 2) * 0.5
            cells.append(DayCell(id: day, day: day, dateString: dateString, diary: diary, isToday: dateString == todayString, tilt: tilt))
        }
        return cells
    }

    private func openWrite(date: String, existing: DiaryItem?) {
        screen = .write(date: date, existing: existing)
    }

    private func moveDay(from dateString: String, by delta: Int) {
        guard let date = Self.isoDateFormatter.date(from: dateString),
              let newDate = calendar.date(byAdding: .day, value: delta, to: date)
        else { return }
        let newDateString = Self.isoDateFormatter.string(from: newDate)
        if let diary = diariesByDate[newDateString] {
            screen = .detail(date: diary.date)
        } else {
            openWrite(date: newDateString, existing: nil)
        }
    }

    private func changeMonth(by value: Int) {
        if let newDate = calendar.date(byAdding: .month, value: value, to: monthAnchor) {
            monthAnchor = newDate
            Task { await loadDiaries() }
        }
    }

    private func loadDiaries() async {
        isLoading = true
        errorMessage = ""
        do {
            let year = calendar.component(.year, from: monthAnchor)
            let month = calendar.component(.month, from: monthAnchor)
            let items = try await SupabaseService.shared.fetchDiaries(year: year, month: month)
            var map: [String: DiaryItem] = [:]
            for item in items { map[item.date] = item }
            diariesByDate = map
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
        isLoading = false
    }
}
