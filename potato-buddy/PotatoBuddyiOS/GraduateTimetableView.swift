import SwiftUI

// MARK: - 데이터 모델

private struct GraduatePeriod: Identifiable {
    let id: String
    let startTime: String
    let endTime: String

    var timeRange: String { "\(startTime) ~ \(endTime)" }

    func isInProgress(now: Date) -> Bool {
        let cal = Calendar.current
        let nowMin = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        return nowMin >= parseMinutes(startTime) && nowMin <= parseMinutes(endTime)
    }

    private func parseMinutes(_ time: String) -> Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return 0 }
        return parts[0] * 60 + parts[1]
    }
}

private struct GraduateCourse {
    let name: String
    let classroom: String
}

private struct GraduateDay: Identifiable {
    let id: String
    let swiftWeekday: Int  // Calendar.weekday: 2=월, 5=목
    let label: String
    let classes: [String: GraduateCourse]
}

private struct GraduateSemester: Identifiable {
    let id: String
    let label: String
    let periods: [GraduatePeriod]
    let days: [GraduateDay]
}

// MARK: - 시간표 데이터

private let eveningPeriods: [GraduatePeriod] = [
    GraduatePeriod(id: "period-1", startTime: "18:50", endTime: "20:20"),
    GraduatePeriod(id: "period-2", startTime: "20:30", endTime: "22:00"),
]

private let semesters: [GraduateSemester] = [
    GraduateSemester(
        id: "2026-2",
        label: "2026년 2학기",
        periods: eveningPeriods,
        days: [
            GraduateDay(
                id: "monday",
                swiftWeekday: 2,
                label: "월요일",
                classes: [
                    "period-1": GraduateCourse(name: "세계문학탐구", classroom: "공D602"),
                    "period-2": GraduateCourse(name: "철학적사고와태도", classroom: "공D405"),
                ]
            ),
            GraduateDay(
                id: "thursday",
                swiftWeekday: 5,
                label: "목요일",
                classes: [
                    "period-1": GraduateCourse(name: "미래사회와공학", classroom: "공D602"),
                    "period-2": GraduateCourse(name: "융합인문공학전공 세미나II", classroom: "공D602"),
                ]
            ),
        ]
    ),
]

private let semesterStorageKey = "graduate-timetable-semester"

// MARK: - 메인 뷰

struct GraduateTimetableView: View {
    @State private var now = Date()
    @State private var selectedSemesterId: String = {
        let saved = UserDefaults.standard.string(forKey: semesterStorageKey) ?? ""
        return semesters.contains(where: { $0.id == saved }) ? saved : semesters.first?.id ?? ""
    }()

    private let ticker = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private var selectedSemester: GraduateSemester? {
        semesters.first { $0.id == selectedSemesterId } ?? semesters.first
    }

    private var todayWeekday: Int {
        Calendar.current.component(.weekday, from: now)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // 제목
                HStack(spacing: 8) {
                    Text("🎓")
                        .font(.title2)
                    Text("대학원 시간표")
                        .font(.title2.bold())
                }
                .padding(.top, 4)

                // 학기 선택
                VStack(alignment: .leading, spacing: 6) {
                    Text("학기")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)

                    if semesters.count > 1 {
                        Picker("학기", selection: $selectedSemesterId) {
                            ForEach(semesters) { semester in
                                Text(semester.label).tag(semester.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color(UIColor.systemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.green.opacity(0.4), lineWidth: 1.5)
                        )
                        .onChange(of: selectedSemesterId) { _, newId in
                            UserDefaults.standard.set(newId, forKey: semesterStorageKey)
                        }
                    } else if let semester = selectedSemester {
                        Text(semester.label)
                            .font(.body.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color(UIColor.systemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.green.opacity(0.4), lineWidth: 1.5)
                            )
                    }
                }

                // 요일 카드 목록
                if let semester = selectedSemester {
                    if semester.days.isEmpty {
                        Text("이 학기에 등록된 수업이 없습니다.")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    } else {
                        ForEach(semester.days) { day in
                            DayCard(
                                day: day,
                                periods: semester.periods,
                                isToday: day.swiftWeekday == todayWeekday,
                                now: now
                            )
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
        .onReceive(ticker) { date in now = date }
    }
}

// MARK: - 요일 카드

private struct DayCard: View {
    let day: GraduateDay
    let periods: [GraduatePeriod]
    let isToday: Bool
    let now: Date

    var body: some View {
        VStack(spacing: 0) {
            // 헤더
            HStack(spacing: 8) {
                Text(day.label)
                    .font(.headline)
                if isToday {
                    Text("오늘")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.green)
                        .clipShape(Capsule())
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(isToday ? Color.green.opacity(0.12) : Color.green.opacity(0.06))

            Divider()
                .overlay(Color.green.opacity(0.2))

            // 교시 목록
            VStack(spacing: 0) {
                ForEach(Array(periods.enumerated()), id: \.element.id) { index, period in
                    if index > 0 {
                        Divider()
                            .padding(.horizontal, 16)
                            .overlay(Color.green.opacity(0.15))
                    }
                    PeriodRow(
                        period: period,
                        course: day.classes[period.id],
                        isNow: isToday && period.isInProgress(now: now)
                    )
                }
            }
        }
        .background(Color(UIColor.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(isToday ? Color.green.opacity(0.6) : Color.green.opacity(0.2), lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }
}

// MARK: - 교시 행

private struct PeriodRow: View {
    let period: GraduatePeriod
    let course: GraduateCourse?
    let isNow: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(period.timeRange)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            if let course {
                VStack(alignment: .leading, spacing: 4) {
                    Text(course.name)
                        .font(.body.weight(.bold))
                        .foregroundStyle(isNow ? .white : .primary)
                    Text(course.classroom)
                        .font(.subheadline)
                        .foregroundStyle(isNow ? .white.opacity(0.85) : .secondary)

                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isNow ? Color.green : Color.green.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    isNow
                        ? RoundedRectangle(cornerRadius: 12).stroke(Color.green.opacity(0.4), lineWidth: 2)
                        : nil
                )
            } else {
                Text("수업 없음")
                    .foregroundStyle(Color(UIColor.tertiaryLabel))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.systemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(16)
    }
}
