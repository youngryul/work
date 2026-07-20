import SwiftUI

private struct MediumDetentModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) {
            content.presentationDetents([.medium])
        } else {
            content
        }
    }
}

struct ScheduleCalendarView: View {
    @State private var schedules: [ScheduleItem] = []
    @State private var scheduleTags: [ScheduleTagItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var selectedYear: Int
    @State private var selectedMonth: Int
    @State private var selectedDate: String
    @State private var showAddSheet = false
    @State private var newTitle = ""
    @State private var newTagName: String = "업무"
    @State private var isSaving = false

    // 생리 관련
    @State private var menstrualSettings: MenstrualSettings = .defaultSettings
    @State private var menstrualRecords: [MenstrualPeriodRecord] = []
    @State private var menstrualMarkers: [String: MenstrualMarkerType] = [:]
    @State private var showMenstrualSettings = false
    @State private var menstrualCycleInput: Int = 28
    @State private var menstrualPeriodInput: Int = 5
    @State private var isSavingMenstrual = false

    private let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]
    private let calendar = Calendar(identifier: .gregorian)

    private var tagColorMap: [String: Color] {
        Dictionary(uniqueKeysWithValues: scheduleTags.map { ($0.name, $0.swiftUIColor) })
    }

    init() {
        let now = Date()
        _selectedYear = State(initialValue: Calendar(identifier: .gregorian).component(.year, from: now))
        _selectedMonth = State(initialValue: Calendar(identifier: .gregorian).component(.month, from: now))
        _selectedDate = State(initialValue: ScheduleDateHelper.todayString())
    }

    private var monthTitle: String { "\(selectedYear)년 \(selectedMonth)월" }

    private var daysInMonth: Int {
        var components = DateComponents()
        components.year = selectedYear
        components.month = selectedMonth
        components.day = 1
        guard let date = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: date)
        else { return 30 }
        return range.count
    }

    private var firstWeekdayOffset: Int {
        var components = DateComponents()
        components.year = selectedYear
        components.month = selectedMonth
        components.day = 1
        guard let date = calendar.date(from: components) else { return 0 }
        return calendar.component(.weekday, from: date) - 1
    }

    private var selectedDaySchedules: [ScheduleItem] {
        schedules.filter { $0.contains(date: selectedDate) }
    }

    private var selectedDateMenstrualMarker: MenstrualMarkerType? {
        menstrualMarkers[selectedDate]
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                monthHeader
                Divider()
                calendarGrid
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                Divider()
                    .padding(.top, 8)
                dayScheduleSection
            }
            .navigationTitle("일정")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        menstrualCycleInput = menstrualSettings.cycleLength
                        menstrualPeriodInput = menstrualSettings.periodLength
                        showMenstrualSettings = true
                    } label: {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.pink)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newTitle = ""
                        newTagName = scheduleTags.first?.name
                            ?? DefaultScheduleTags.seed.first?.name
                            ?? "업무"
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                    .disabled(selectedDate.isEmpty)
                }
            }
            .sheet(isPresented: $showAddSheet) {
                addScheduleSheet
            }
            .sheet(isPresented: $showMenstrualSettings) {
                menstrualSettingsSheet
            }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { _ in errorMessage = "" }
            )) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
        }
        .task {
            async let schedulesLoad: Void = loadSchedules()
            async let tagsLoad: Void = loadTags()
            async let menstrualLoad: Void = loadMenstrualData()
            _ = await (schedulesLoad, tagsLoad, menstrualLoad)
        }
    }

    // MARK: - 월 헤더

    private var monthHeader: some View {
        HStack {
            Button { changeMonth(by: -1) } label: {
                Image(systemName: "chevron.left")
                    .foregroundColor(.green)
                    .padding(8)
            }
            Spacer()
            Text(monthTitle).font(.headline)
            Spacer()
            Button { changeMonth(by: 1) } label: {
                Image(systemName: "chevron.right")
                    .foregroundColor(.green)
                    .padding(8)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - 달력 그리드

    private var calendarGrid: some View {
        VStack(spacing: 6) {
            HStack {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.system(.caption, weight: .semibold))
                        .foregroundColor(symbol == "일" ? .red : (symbol == "토" ? .blue : .secondary))
                        .frame(maxWidth: .infinity)
                }
            }

            let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(0..<firstWeekdayOffset, id: \.self) { _ in
                    Color.clear.frame(height: 44)
                }
                ForEach(1...daysInMonth, id: \.self) { day in
                    let ds = dateString(year: selectedYear, month: selectedMonth, day: day)
                    dayCell(day: day, dateString: ds)
                }
            }
        }
    }

    private func dayCell(day: Int, dateString: String) -> some View {
        let daySchedules = schedules.filter { $0.contains(date: dateString) }
        let isSelected = dateString == selectedDate
        let isToday = dateString == ScheduleDateHelper.todayString()
        let menstrualMarker = menstrualMarkers[dateString]

        return Button {
            selectedDate = dateString
        } label: {
            VStack(spacing: 2) {
                Text("\(day)")
                    .font(.system(.subheadline, weight: isToday ? .bold : .regular))
                    .foregroundColor(isSelected ? .white : (isToday ? .green : .primary))

                HStack(spacing: 2) {
                    // 생리 마커
                    if let marker = menstrualMarker {
                        switch marker {
                        case .recorded:
                            Circle()
                                .fill(isSelected ? Color.white : Color.pink)
                                .frame(width: 5, height: 5)
                        case .predicted:
                            Circle()
                                .fill(isSelected ? Color.white.opacity(0.7) : Color.pink.opacity(0.4))
                                .frame(width: 5, height: 5)
                        }
                    }
                    // 일정 마커
                    ForEach(Array(daySchedules.prefix(2).enumerated()), id: \.offset) { _, item in
                        Circle()
                            .fill(isSelected ? Color.white.opacity(0.9) : tagColor(for: item.tag))
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 7)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(cellBackground(isSelected: isSelected, isToday: isToday, marker: menstrualMarker))
            )
        }
        .buttonStyle(.plain)
    }

    private func cellBackground(isSelected: Bool, isToday: Bool, marker: MenstrualMarkerType?) -> Color {
        if isSelected { return .green }
        if isToday { return Color.green.opacity(0.12) }
        if let marker = marker {
            switch marker {
            case .recorded: return Color.pink.opacity(0.18)
            case .predicted: return Color.pink.opacity(0.07)
            }
        }
        return .clear
    }

    // MARK: - 하단 일정 + 생리 섹션

    private var dayScheduleSection: some View {
        Group {
            if isLoading {
                ProgressView("불러오는 중...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text(formattedDate(selectedDate))
                        .font(.system(.subheadline, weight: .semibold))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                    // 생리 상태 패널
                    menstrualDayPanel
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)

                    if selectedDaySchedules.isEmpty {
                        VStack(spacing: 12) {
                            Text("이 날 일정이 없어요")
                                .font(.body)
                                .foregroundColor(.secondary)
                            Button {
                                newTitle = ""
                                newTagName = scheduleTags.first?.name ?? "업무"
                                showAddSheet = true
                            } label: {
                                Label("일정 추가", systemImage: "plus.circle.fill")
                                    .foregroundColor(.green)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        List {
                            ForEach(selectedDaySchedules) { schedule in
                                scheduleRow(schedule)
                            }
                        }
                        .listStyle(.plain)
                        .refreshable { await loadSchedules() }
                    }
                }
            }
        }
    }

    // MARK: - 생리 패널

    @ViewBuilder
    private var menstrualDayPanel: some View {
        if case .recorded(let recordId) = selectedDateMenstrualMarker {
            HStack(spacing: 8) {
                Image(systemName: "heart.fill")
                    .foregroundColor(.pink)
                    .font(.caption)
                Text("생리 중")
                    .font(.system(.caption, weight: .semibold))
                    .foregroundColor(.pink)
                Spacer()
                Button {
                    Task { await deleteMenstrualRecord(id: recordId) }
                } label: {
                    Text("기록 삭제")
                        .font(.caption)
                        .foregroundColor(.pink)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.pink.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
            .padding(10)
            .background(Color.pink.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        } else if case .predicted = selectedDateMenstrualMarker {
            HStack(spacing: 8) {
                Image(systemName: "heart.circle")
                    .foregroundColor(.pink.opacity(0.6))
                    .font(.caption)
                Text("예측 생리")
                    .font(.system(.caption, weight: .semibold))
                    .foregroundColor(.pink.opacity(0.7))
                Spacer()
                Button {
                    Task { await recordPeriodStart() }
                } label: {
                    Text("시작일 기록")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.pink.opacity(0.7))
                        .clipShape(Capsule())
                }
            }
            .padding(10)
            .background(Color.pink.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.pink.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4]))
            )
        } else {
            Button {
                Task { await recordPeriodStart() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "heart")
                        .font(.caption)
                    Text("이 날 생리 시작일로 기록")
                        .font(.caption)
                }
                .foregroundColor(.pink.opacity(0.6))
            }
        }
    }

    // MARK: - 일정 행

    private func scheduleRow(_ schedule: ScheduleItem) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(tagColor(for: schedule.tag))
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(schedule.title)
                    .font(.body)
                    .foregroundColor(.primary)

                HStack(spacing: 6) {
                    Text(schedule.tag)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(tagColor(for: schedule.tag).opacity(0.15))
                        .foregroundColor(tagColor(for: schedule.tag))
                        .clipShape(Capsule())

                    if schedule.isMultiDay {
                        Text("\(formattedShortDate(schedule.scheduleDate)) ~ \(formattedShortDate(schedule.resolvedEndDate))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            Spacer(minLength: 0)
            Button(role: .destructive) {
                Task { await deleteSchedule(schedule) }
            } label: {
                Image(systemName: "trash").font(.body)
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await deleteSchedule(schedule) }
            } label: {
                Label("삭제", systemImage: "trash")
            }
        }
    }

    // MARK: - 일정 추가 시트

    private var addScheduleSheet: some View {
        NavigationView {
            Form {
                Section("날짜") { Text(formattedDate(selectedDate)) }
                Section("일정") { TextField("제목", text: $newTitle) }
                Section("태그") {
                    if scheduleTags.isEmpty {
                        Text("태그를 불러오는 중...").foregroundColor(.secondary)
                    } else {
                        Picker("태그", selection: $newTagName) {
                            ForEach(scheduleTags) { tag in
                                HStack {
                                    Circle().fill(tag.swiftUIColor).frame(width: 10, height: 10)
                                    Text(tag.name)
                                }
                                .tag(tag.name)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }
            }
            .navigationTitle("일정 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { showAddSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await saveSchedule() } }
                        .disabled(newTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
        .modifier(MediumDetentModifier())
    }

    // MARK: - 생리 설정 시트

    private var menstrualSettingsSheet: some View {
        NavigationView {
            Form {
                Section {
                    HStack {
                        Text("주기")
                        Spacer()
                        Stepper("\(menstrualCycleInput)일", value: $menstrualCycleInput, in: 21...45)
                    }
                    HStack {
                        Text("생리 기간")
                        Spacer()
                        Stepper("\(menstrualPeriodInput)일", value: $menstrualPeriodInput, in: 2...10)
                    }
                } header: {
                    Text("생리 주기 설정")
                } footer: {
                    Text("설정을 저장하면 달력에 예측 생리일이 표시됩니다.")
                }

                Section {
                    HStack(spacing: 12) {
                        Circle().fill(Color.pink).frame(width: 10, height: 10)
                        Text("기록된 생리").font(.caption).foregroundColor(.secondary)
                        Circle().fill(Color.pink.opacity(0.35)).frame(width: 10, height: 10)
                        Text("예측 생리").font(.caption).foregroundColor(.secondary)
                    }
                } header: {
                    Text("범례")
                }
            }
            .navigationTitle("생리 주기")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { showMenstrualSettings = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await saveMenstrualSettings() } }
                        .disabled(isSavingMenstrual)
                }
            }
        }
        .modifier(MediumDetentModifier())
    }

    // MARK: - 데이터 로드

    private func loadTags() async {
        do {
            scheduleTags = try await SupabaseService.shared.fetchOrCreateScheduleTags()
            if !scheduleTags.contains(where: { $0.name == newTagName }) {
                newTagName = scheduleTags.first?.name ?? "업무"
            }
        } catch {
            scheduleTags = DefaultScheduleTags.seed.enumerated().map { index, tag in
                ScheduleTagItem(id: "default-\(index)", name: tag.name, color: tag.color)
            }
        }
    }

    private func loadSchedules() async {
        isLoading = true
        errorMessage = ""
        do {
            schedules = try await SupabaseService.shared.fetchSchedules(year: selectedYear, month: selectedMonth)
            syncWidgetIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMenstrualData() async {
        do {
            async let settingsLoad = SupabaseService.shared.getMenstrualSettings()
            async let recordsLoad = SupabaseService.shared.getMenstrualRecords(year: selectedYear, month: selectedMonth)
            let (settings, records) = try await (settingsLoad, recordsLoad)
            menstrualSettings = settings
            menstrualRecords = records
            rebuildMarkers()
        } catch {
            // 생리 데이터 로드 실패 시 무시
        }
    }

    private func rebuildMarkers() {
        menstrualMarkers = MenstrualCalendarHelper.buildMarkers(
            records: menstrualRecords,
            settings: menstrualSettings,
            year: selectedYear,
            month: selectedMonth
        )
    }

    private func saveSchedule() async {
        let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        isSaving = true
        errorMessage = ""
        do {
            let created = try await SupabaseService.shared.createSchedule(
                scheduleDate: selectedDate,
                endDate: selectedDate,
                title: title,
                tag: newTagName
            )
            schedules.append(created)
            schedules.sort { $0.scheduleDate < $1.scheduleDate }
            syncWidgetIfNeeded()
            showAddSheet = false
            newTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func deleteSchedule(_ schedule: ScheduleItem) async {
        do {
            try await SupabaseService.shared.deleteSchedule(id: schedule.id)
            schedules.removeAll { $0.id == schedule.id }
            syncWidgetIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
            await loadSchedules()
        }
    }

    private func saveMenstrualSettings() async {
        isSavingMenstrual = true
        do {
            try await SupabaseService.shared.saveMenstrualSettings(
                cycleLength: menstrualCycleInput,
                periodLength: menstrualPeriodInput
            )
            menstrualSettings.cycleLength = menstrualCycleInput
            menstrualSettings.periodLength = menstrualPeriodInput
            rebuildMarkers()
            showMenstrualSettings = false
        } catch {
            errorMessage = error.localizedDescription
        }
        isSavingMenstrual = false
    }

    private func recordPeriodStart() async {
        do {
            let record = try await SupabaseService.shared.recordPeriodStart(
                startDate: selectedDate,
                periodLength: menstrualSettings.periodLength
            )
            menstrualRecords.append(record)
            rebuildMarkers()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteMenstrualRecord(id: String) async {
        do {
            try await SupabaseService.shared.deleteMenstrualRecord(id: id)
            menstrualRecords.removeAll { $0.id == id }
            rebuildMarkers()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - 헬퍼

    private func syncWidgetIfNeeded() {
        let cal = Calendar.current
        let now = Date()
        guard selectedYear == cal.component(.year, from: now),
              selectedMonth == cal.component(.month, from: now) else { return }
        Task { await ScheduleWidgetService.refreshTodayWidget() }
    }

    private func changeMonth(by value: Int) {
        var components = DateComponents()
        components.year = selectedYear
        components.month = selectedMonth + value
        guard let newDate = calendar.date(from: components) else { return }

        selectedYear = calendar.component(.year, from: newDate)
        selectedMonth = calendar.component(.month, from: newDate)

        let today = ScheduleDateHelper.todayString()
        let range = ScheduleDateHelper.monthRange(year: selectedYear, month: selectedMonth)
        selectedDate = (today >= range.start && today <= range.end) ? today : range.start

        Task {
            async let schedulesLoad: Void = loadSchedules()
            async let menstrualLoad: Void = loadMenstrualData()
            _ = await (schedulesLoad, menstrualLoad)
        }
    }

    private func dateString(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    private func formattedDate(_ dateString: String) -> String {
        guard let date = ScheduleDateHelper.dayFormatter.date(from: dateString) else { return dateString }
        let f = DateFormatter()
        f.dateFormat = "M월 d일 (E)"
        f.locale = Locale(identifier: "ko_KR")
        return f.string(from: date)
    }

    private func formattedShortDate(_ dateString: String) -> String {
        guard let date = ScheduleDateHelper.dayFormatter.date(from: dateString) else { return dateString }
        let f = DateFormatter()
        f.dateFormat = "M/d"
        return f.string(from: date)
    }

    private func tagColor(for name: String) -> Color {
        if let color = tagColorMap[name] { return color }
        return .gray
    }
}
