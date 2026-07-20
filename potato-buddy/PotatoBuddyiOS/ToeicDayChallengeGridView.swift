import SwiftUI

struct ToeicDayChallengeGridView: View {
    let dayCount: Int
    let selectedDay: Int
    let onSelectDay: (Int) -> Void

    @ObservedObject var completionModel: ToeicCompletionViewModel

    private let columns = [
        GridItem(.adaptive(minimum: 56), spacing: 8),
    ]

    var body: some View {
        VStack(spacing: 12) {
            VStack(spacing: 4) {
                Text("day challenge")
                    .font(.system(size: 26, weight: .regular, design: .serif))
                    .italic()
                    .foregroundColor(Color(red: 0.55, green: 0.63, blue: 0.83))
                Text("Day 완료 기록 · DAY 1-\(dayCount)")
                    .font(.subheadline)
                    .foregroundColor(Color(red: 0.55, green: 0.63, blue: 0.83))
                if completionModel.isLoading {
                    Text("완료 기록 불러오는 중...")
                        .font(.caption2)
                        .foregroundColor(Color(red: 0.6, green: 0.67, blue: 0.86))
                }
                if !completionModel.statusMessage.isEmpty {
                    Text(completionModel.statusMessage)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(1...max(dayCount, 1), id: \.self) { day in
                    dayCell(day: day, isLast: day == dayCount)
                }
            }

            Text("포실이 탭 = 완료 +1 · -1 = 줄이기 · Day 글자 = 공부 Day 선택")
                .font(.caption2)
                .foregroundColor(Color(red: 0.6, green: 0.67, blue: 0.86))
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(Color(red: 0.98, green: 0.98, blue: 0.96))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(red: 0.79, green: 0.83, blue: 0.94), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func dayCell(day: Int, isLast: Bool) -> some View {
        let count = completionModel.count(for: day)
        let isSelected = day == selectedDay

        VStack(spacing: 4) {
            Button {
                onSelectDay(day)
            } label: {
                Text("Day \(day)")
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(isSelected ? Color(red: 0.35, green: 0.44, blue: 0.72) : Color(red: 0.6, green: 0.67, blue: 0.86))
            }
            .buttonStyle(.plain)

            Button {
                onSelectDay(day)
                Task { await completionModel.increment(day: day) }
            } label: {
                ZStack {
                    Image("포실이(투명)")
                        .resizable()
                        .scaledToFit()
                        .opacity(count > 0 ? 1 : 0.35)
                    if count > 0 {
                        Text("\(count)")
                            .font(.caption2.bold())
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color(red: 0.55, green: 0.63, blue: 0.83))
                            .clipShape(Capsule())
                            .offset(x: 18, y: 18)
                    }
                    if isLast {
                        Text("💕")
                            .font(.caption2)
                            .offset(x: 20, y: -20)
                    }
                }
                .frame(width: 48, height: 48)
                .overlay {
                    if isSelected {
                        Circle()
                            .stroke(Color(red: 0.55, green: 0.63, blue: 0.83), lineWidth: 2)
                            .padding(-4)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(completionModel.isSaving)

            if count > 0 {
                Button("-1") {
                    Task { await completionModel.decrement(day: day) }
                }
                .font(.caption2)
                .foregroundColor(Color(red: 0.6, green: 0.67, blue: 0.86))
                .disabled(completionModel.isSaving)
            }
        }
    }
}
