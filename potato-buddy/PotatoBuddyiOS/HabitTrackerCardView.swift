import SwiftUI

struct HabitTrackerCardView: View {
    let tracker: HabitTrackerItem
    let year: Int
    let month: Int
    let onToggleDay: (Int, Bool) async -> Void
    let onEditTitle: () -> Void

    private var totalDays: Int {
        HabitTrackerDateHelper.daysInMonth(year: year, month: month)
    }

    private var gridRows: [[Int]] {
        HabitTrackerDateHelper.gridRows(totalDays: totalDays)
    }

    private var gridCells: [HabitTrackerGridCell] {
        gridRows.enumerated().flatMap { rowIndex, row in
            row.enumerated().map { columnIndex, day in
                HabitTrackerGridCell(id: "\(rowIndex)-\(columnIndex)", day: day)
            }
        }
    }

    private var completionRate: Int {
        tracker.completionRate(totalDays: totalDays)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onEditTitle) {
                Text(tracker.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(tracker.accentColor.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: 10))

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
                spacing: 4
            ) {
                ForEach(gridCells) { cell in
                    if cell.day == 0 {
                        Color.clear.frame(height: 32)
                    } else {
                        dayButton(day: cell.day)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("완료율")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(tracker.completedCount) / \(totalDays) (\(completionRate)%)")
                        .font(.caption)
                        .fontWeight(.semibold)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(.systemGray5))
                        Capsule()
                            .fill(tracker.accentColor)
                            .frame(width: geometry.size.width * CGFloat(completionRate) / 100)
                    }
                }
                .frame(height: 8)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color(.separator).opacity(0.4), lineWidth: 1)
        )
    }

    private func dayButton(day: Int) -> some View {
        let isCompleted = tracker.isDayCompleted(day)
        let isFutureDay = isFuture(day: day)

        return Button {
            guard !isFutureDay else { return }
            Task {
                await onToggleDay(day, !isCompleted)
            }
        } label: {
            Text("\(day)")
                .font(.caption2)
                .fontWeight(.medium)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .foregroundColor(isCompleted ? .white : .primary)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(
                            isCompleted
                                ? tracker.accentColor
                                : Color(.systemGray5)
                        )
                )
                .opacity(isFutureDay ? 0.35 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isFutureDay)
    }

    private func isFuture(day: Int) -> Bool {
        let calendar = Calendar.current
        let now = Date()
        let currentYear = calendar.component(.year, from: now)
        let currentMonth = calendar.component(.month, from: now)
        let currentDay = calendar.component(.day, from: now)

        if year < currentYear { return false }
        if year > currentYear { return true }
        if month < currentMonth { return false }
        if month > currentMonth { return true }
        return day > currentDay
    }
}

private struct HabitTrackerGridCell: Identifiable {
    let id: String
    let day: Int
}
