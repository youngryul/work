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
    /// 랜덤으로 연 일기 날짜 (상세 화면에 '다른 날 보기' 표시)
    @State private var randomDate: String?
    @State private var isPickingRandom = false
    @ObservedObject private var openRequest = DiaryOpenRequest.shared

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
                                },
                                onAutoSaved: { saved in
                                    // 사진 자동 저장: 작성 화면은 유지하고 달력 데이터만 갱신
                                    diariesByDate[saved.date] = saved
                                }
                            )
                        case .detail(let date):
                            if let diary = diariesByDate[date] {
                                DiaryDetailView(
                                    diary: diary,
                                    onBack: { randomDate = nil; screen = .calendar },
                                    onEdit: { screen = .write(date: date, existing: diary) },
                                    onPrevDay: { moveDay(from: date, by: -1) },
                                    onNextDay: { moveDay(from: date, by: 1) },
                                    onCoverUpdated: { updated in diariesByDate[updated.date] = updated },
                                    onRandomNext: randomDate == date ? { Task { await openRandomDiary() } } : nil,
                                    isPickingRandom: isPickingRandom
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
        .task {
            await loadDiaries()
            await consumeOpenRequest()
        }
        .onChange(of: openRequest.pendingDate) { _, _ in
            Task { await consumeOpenRequest() }
        }
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
                Button {
                    Task { await openRandomDiary() }
                } label: {
                    HStack(spacing: 8) {
                        Text("🎲").font(.system(size: 17))
                        Text(isPickingRandom ? "지난 일기 고르는 중..." : "그날의 일기 꺼내 보기").font(.sketchbook(18))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundStyle(SketchbookStyle.ink)
                    .background(SketchbookStyle.paper)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(SketchbookStyle.ink, lineWidth: 2))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .disabled(isPickingRandom)

                HStack(spacing: 14) {
                    Text("AI 4컷 · \(countByKind(.aiFourCut))")
                    Text("사진 · \(countByKind(.photos))")
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
            // 칸 크기는 정사각형으로 고정하고, 사진은 overlay로 얹어 잘라낸다
            // (ZStack에 .fill 이미지를 넣으면 세로/가로 사진 비율대로 칸이 늘어나 달력이 깨짐)
            RoundedRectangle(cornerRadius: 2)
                .fill(cell.diary != nil ? Color.white : Color.white.opacity(0.4))
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    if let urlString = cell.diary?.thumbnailUrl, let url = URL(string: urlString) {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image
                                    .resizable()
                                    .scaledToFill()
                            }
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 2))
                // 잘려 나간 사진 영역이 옆 칸 터치를 가로채지 않도록 터치 영역도 칸 크기로 제한
                .contentShape(RoundedRectangle(cornerRadius: 2))
                .overlay(alignment: .topLeading) {
                    if let day = cell.day {
                        Text("\(day)")
                            .font(.system(size: 11))
                            .foregroundStyle(cell.diary != nil ? SketchbookStyle.ink : SketchbookStyle.mutedLight)
                            .padding(.horizontal, cell.diary?.thumbnailUrl != nil ? 3 : 0)
                            // 사진 위에서도 날짜가 보이도록 흰 배경
                            .background {
                                if cell.diary?.thumbnailUrl != nil {
                                    RoundedRectangle(cornerRadius: 3).fill(Color.white.opacity(0.85))
                                }
                            }
                            .padding(3)
                    }
                }
                .overlay {
                    if cell.isToday {
                        RoundedRectangle(cornerRadius: 3)
                            .stroke(SketchbookStyle.greenDark, lineWidth: 2.5)
                    }
                }
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

    private enum DiaryKind { case aiFourCut, photos }

    private func countByKind(_ kind: DiaryKind) -> Int {
        diariesByDate.values.filter { item in
            switch kind {
            case .aiFourCut: return item.hasAiFourCut
            case .photos: return item.hasPhotos
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
        randomDate = nil
        screen = .write(date: date, existing: existing)
    }

    /// 과거 일기 하나를 랜덤으로 열기
    private func openRandomDiary() async {
        guard !isPickingRandom else { return }
        isPickingRandom = true
        defer { isPickingRandom = false }
        do {
            let dates = try await SupabaseService.shared.fetchPastDiaryDates(before: todayDateString)
            guard let picked = DiaryMemory.pickRandomDate(from: dates, current: randomDate) else {
                errorMessage = "아직 지난 일기가 없어요. 오늘 일기부터 그려 볼까요?"
                return
            }
            if await showDiary(date: picked) {
                randomDate = picked
            }
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    /// 다른 탭(1년 전 오늘 카드)에서 요청한 날짜 일기 열기
    private func consumeOpenRequest() async {
        guard let date = openRequest.pendingDate else { return }
        openRequest.pendingDate = nil
        randomDate = nil
        _ = await showDiary(date: date)
    }

    /// 해당 날짜가 속한 달로 이동한 뒤 일기 상세를 연다
    private func showDiary(date: String) async -> Bool {
        guard let target = Self.isoDateFormatter.date(from: date) else { return false }
        let sameMonth = calendar.isDate(target, equalTo: monthAnchor, toGranularity: .month)
        if !sameMonth || diariesByDate[date] == nil {
            monthAnchor = target
            await loadDiaries()
        }
        if diariesByDate[date] == nil,
           let diary = try? await SupabaseService.shared.fetchDiary(date: date) {
            diariesByDate[date] = diary
        }
        guard diariesByDate[date] != nil else {
            errorMessage = "일기를 불러오지 못했어요."
            return false
        }
        screen = .detail(date: date)
        return true
    }

    private func moveDay(from dateString: String, by delta: Int) {
        guard let date = Self.isoDateFormatter.date(from: dateString),
              let newDate = calendar.date(byAdding: .day, value: delta, to: date)
        else { return }
        let newDateString = Self.isoDateFormatter.string(from: newDate)
        if let diary = diariesByDate[newDateString] {
            randomDate = nil
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
