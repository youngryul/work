import SwiftUI

struct ScheduleCalendarView: View {
    @State private var schedules: [ScheduleItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var selectedYear: Int
    @State private var selectedMonth: Int
    @State private var selectedDate: String
    @State private var showAddSheet = false
    @State private var newTitle = ""
    @State private var newTag: ScheduleTagOption = .work
    @State private var isSaving = false

    private let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]
    private let calendar = Calendar(identifier: .gregorian)

    init() {
        let now = Date()
        _selectedYear = State(initialValue: calendar.component(.year, from: now))
        _selectedMonth = State(initialValue: calendar.component(.month, from: now))
        _selectedDate = State(initialValue: ScheduleDateHelper.todayString())
    }

    private var monthTitle: String {
        "\(selectedYear)년 \(selectedMonth)월"
    }

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
        let weekday = calendar.component(.weekday, from: date)
        return weekday - 1
    }

    private var selectedDaySchedules: [ScheduleItem] {
        schedules.filter { $0.contains(date: selectedDate) }
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
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        newTitle = ""
                        newTag = .work
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
            await loadSchedules()
        }
    }

    private var monthHeader: some View {
        HStack {
            Button { changeMonth(by: -1) } label: {
                Image(systemName: "chevron.left")
                    .foregroundColor(.green)
                    .padding(8)
            }

            Spacer()

            Text(monthTitle)
                .font(.headline)

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

    private var calendarGrid: some View {
        VStack(spacing: 6) {
            HStack {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.caption)
                        .fontWeight(.semibold)
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
                    let dateString = dateString(year: selectedYear, month: selectedMonth, day: day)
                    dayCell(day: day, dateString: dateString)
                }
            }
        }
    }

    private func dayCell(day: Int, dateString: String) -> some View {
        let daySchedules = schedules.filter { $0.contains(date: dateString) }
        let isSelected = dateString == selectedDate
        let isToday = dateString == ScheduleDateHelper.todayString()

        return Button {
            selectedDate = dateString
        } label: {
            VStack(spacing: 3) {
                Text("\(day)")
                    .font(.subheadline)
                    .fontWeight(isToday ? .bold : .regular)
                    .foregroundColor(isSelected ? .white : (isToday ? .green : .primary))

                if !daySchedules.isEmpty {
                    HStack(spacing: 2) {
                        ForEach(Array(daySchedules.prefix(3).enumerated()), id: \.offset) { _, item in
                            Circle()
                                .fill(isSelected ? Color.white.opacity(0.9) : tagColor(for: item.tag))
                                .frame(width: 5, height: 5)
                        }
                    }
                } else {
                    Spacer().frame(height: 5)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.green : (isToday ? Color.green.opacity(0.12) : Color.clear))
            )
        }
        .buttonStyle(.plain)
    }

    private var dayScheduleSection: some View {
        Group {
            if isLoading {
                ProgressView("불러오는 중...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text(formattedDate(selectedDate))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                    if selectedDaySchedules.isEmpty {
                        VStack(spacing: 12) {
                            Text("이 날 일정이 없어요")
                                .font(.body)
                                .foregroundColor(.secondary)
                            Button {
                                newTitle = ""
                                newTag = .work
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
                            .onDelete { indexSet in
                                Task { await deleteSchedules(at: indexSet) }
                            }
                        }
                        .listStyle(.plain)
                        .refreshable {
                            await loadSchedules()
                        }
                    }
                }
            }
        }
    }

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
        }
        .padding(.vertical, 4)
    }

    private var addScheduleSheet: some View {
        NavigationView {
            Form {
                Section("날짜") {
                    Text(formattedDate(selectedDate))
                }

                Section("일정") {
                    TextField("제목", text: $newTitle)
                }

                Section("태그") {
                    Picker("태그", selection: $newTag) {
                        ForEach(ScheduleTagOption.allCases) { tag in
                            HStack {
                                Circle()
                                    .fill(tag.color)
                                    .frame(width: 10, height: 10)
                                Text(tag.rawValue)
                            }
                            .tag(tag)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            .navigationTitle("일정 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { showAddSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        Task { await saveSchedule() }
                    }
                    .disabled(newTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func loadSchedules() async {
        isLoading = true
        errorMessage = ""
        do {
            schedules = try await SupabaseService.shared.fetchSchedules(
                year: selectedYear,
                month: selectedMonth
            )
            syncWidgetIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
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
                tag: newTag.rawValue
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

    private func deleteSchedules(at offsets: IndexSet) async {
        let targets = offsets.map { selectedDaySchedules[$0] }
        for schedule in targets {
            do {
                try await SupabaseService.shared.deleteSchedule(id: schedule.id)
                schedules.removeAll { $0.id == schedule.id }
            } catch {
                errorMessage = error.localizedDescription
                await loadSchedules()
                return
            }
        }
        syncWidgetIfNeeded()
    }

    private func syncWidgetIfNeeded() {
        let calendar = Calendar.current
        let now = Date()
        let currentYear = calendar.component(.year, from: now)
        let currentMonth = calendar.component(.month, from: now)
        guard selectedYear == currentYear, selectedMonth == currentMonth else { return }

        let today = ScheduleDateHelper.todayString()
        let todaySchedules = schedules.filter { $0.contains(date: today) }
        ScheduleWidgetService.syncWidgetSnapshot(schedules: todaySchedules, dateString: today)
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
        if today >= range.start && today <= range.end {
            selectedDate = today
        } else {
            selectedDate = range.start
        }

        Task { await loadSchedules() }
    }

    private func dateString(year: Int, month: Int, day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    private func formattedDate(_ dateString: String) -> String {
        guard let date = ScheduleDateHelper.dayFormatter.date(from: dateString) else {
            return dateString
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "M월 d일 (E)"
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.string(from: date)
    }

    private func formattedShortDate(_ dateString: String) -> String {
        guard let date = ScheduleDateHelper.dayFormatter.date(from: dateString) else {
            return dateString
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return formatter.string(from: date)
    }

    private func tagColor(for name: String) -> Color {
        ScheduleTagOption(rawValue: name)?.color ?? .gray
    }
}
