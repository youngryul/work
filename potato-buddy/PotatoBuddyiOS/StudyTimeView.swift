import SwiftUI

/// 일자별 공부 시간 통계 — 달력 뷰
struct StudyTimeView: View {
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var totalSeconds = 0
    @State private var totalDays = 0
    @State private var calYear  = Calendar.current.component(.year,  from: Date())
    @State private var calMonth = Calendar.current.component(.month, from: Date())
    @State private var monthSessions: [StudySessionItem] = []

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // 요약 카드
                    HStack(spacing: 12) {
                        StatCard(
                            title: "최근 6개월 총",
                            value: isLoading ? "..." : formatStudyDuration(totalSeconds),
                            color: .green
                        )
                        StatCard(
                            title: "총 기록일",
                            value: isLoading ? "..." : "\(totalDays)일",
                            color: .orange
                        )
                    }
                    .padding(.horizontal)
                    .padding(.top, 4)

                    if let err = errorMessage {
                        Text(err)
                            .foregroundColor(.red)
                            .font(.caption)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    // 월 네비게이션
                    HStack {
                        Button {
                            if calMonth == 1 { calYear -= 1; calMonth = 12 }
                            else { calMonth -= 1 }
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.title3)
                                .foregroundColor(.primary)
                                .padding(8)
                        }
                        Spacer()
                        Text(verbatim: "\(calYear)년 \(calMonth)월")
                            .font(.headline)
                        Spacer()
                        Button {
                            let now = Date()
                            let nowYear  = Calendar.current.component(.year,  from: now)
                            let nowMonth = Calendar.current.component(.month, from: now)
                            guard calYear < nowYear || (calYear == nowYear && calMonth < nowMonth) else { return }
                            if calMonth == 12 { calYear += 1; calMonth = 1 }
                            else { calMonth += 1 }
                        } label: {
                            Image(systemName: "chevron.right")
                                .font(.title3)
                                .foregroundColor(.primary)
                                .padding(8)
                        }
                    }
                    .padding(.horizontal)

                    // 달력 그리드
                    StudyMonthCalendar(
                        year: calYear,
                        month: calMonth,
                        sessions: monthSessions
                    )
                    .padding(.horizontal)

                    // 이번 달 합계
                    let monthTotal = monthSessions.reduce(0) { $0 + $1.durationSeconds }
                    if monthTotal > 0 {
                        Text("\(calMonth)월 합계: \(formatStudyDuration(monthTotal))")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .padding(.bottom, 8)
                    }
                }
                .padding(.bottom, 20)
            }
            .navigationTitle("공부 통계")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await loadData() }
        .onChange(of: calYear)  { _, _ in Task { await loadMonthData() } }
        .onChange(of: calMonth) { _, _ in Task { await loadMonthData() } }
    }

    // MARK: - 데이터 로드

    private func loadData() async {
        isLoading = true
        errorMessage = nil
        do {
            let items = try await SupabaseService.shared.fetchStudySessions(months: 6)
            var dateSet = Set<String>()
            var total = 0
            for item in items {
                total += item.durationSeconds
                dateSet.insert(item.studyDate)
            }
            totalSeconds = total
            totalDays = dateSet.count
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        await loadMonthData()
    }

    private func loadMonthData() async {
        do {
            monthSessions = try await SupabaseService.shared.fetchStudySessionsForMonth(
                year: calYear, month: calMonth
            )
        } catch {}
    }
}

// MARK: - 서브 컴포넌트

private struct StatCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(color)
            Text(value)
                .font(.title3.bold())
                .foregroundColor(color.opacity(0.9))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(color.opacity(0.1))
        .cornerRadius(16)
    }
}

// MARK: - 월별 달력

private struct StudyMonthCalendar: View {
    let year: Int
    let month: Int
    let sessions: [StudySessionItem]

    private var dayMap: [Int: Int] {
        var map: [Int: Int] = [:]
        for item in sessions {
            let parts = item.studyDate.split(separator: "-")
            guard parts.count == 3, let day = Int(parts[2]) else { continue }
            map[day, default: 0] += item.durationSeconds
        }
        return map
    }

    private var firstWeekday: Int {
        var components = DateComponents()
        components.year = year; components.month = month; components.day = 1
        let date = Calendar.current.date(from: components)!
        return Calendar.current.component(.weekday, from: date) - 1
    }

    private var daysInMonth: Int {
        let components = DateComponents(year: year, month: month)
        let date = Calendar.current.date(from: components)!
        return Calendar.current.range(of: .day, in: .month, for: date)!.count
    }

    private var todayDay: Int? {
        let now = Date()
        guard Calendar.current.component(.year, from: now) == year,
              Calendar.current.component(.month, from: now) == month else { return nil }
        return Calendar.current.component(.day, from: now)
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                ForEach(["일","월","화","수","목","금","토"], id: \.self) { d in
                    Text(d)
                        .font(.caption2.bold())
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }

            let cells: [Int?] = Array(repeating: nil, count: firstWeekday)
                + (1...daysInMonth).map { Optional($0) }
            let rows = stride(from: 0, to: cells.count, by: 7)
                .map { Array(cells[$0..<min($0+7, cells.count)]) }

            ForEach(rows.indices, id: \.self) { rowIdx in
                HStack(spacing: 2) {
                    ForEach(0..<7, id: \.self) { col in
                        let cellIdx = rowIdx * 7 + col
                        if cellIdx < cells.count, let day = cells[cellIdx] {
                            DayCell(
                                day: day,
                                seconds: dayMap[day] ?? 0,
                                isToday: day == todayDay
                            )
                        } else {
                            Color.clear.frame(maxWidth: .infinity, minHeight: 48)
                        }
                    }
                }
            }
        }
    }
}

private struct DayCell: View {
    let day: Int
    let seconds: Int
    let isToday: Bool

    var body: some View {
        VStack(spacing: 2) {
            Text("\(day)")
                .font(.caption.bold())
                .foregroundColor(isToday ? .green : .primary)
            if seconds > 0 {
                Text(formatStudyDurationShort(seconds))
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(.green)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            } else {
                Text(" ").font(.system(size: 9))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(seconds > 0 ? Color.green.opacity(0.12) : Color.clear)
                .overlay(
                    isToday
                        ? RoundedRectangle(cornerRadius: 8).stroke(Color.green, lineWidth: 1.5)
                        : nil
                )
        )
    }
}
