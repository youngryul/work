import SwiftUI

struct StepCounterCardView: View {
    @ObservedObject var viewModel: StepCounterViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("오늘 걸음", systemImage: "figure.walk")
                    .font(.headline)
                    .foregroundColor(.green)

                Spacer()

                if viewModel.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            if !viewModel.isAvailable {
                Text("이 기기에서는 걸음 수 측정을 지원하지 않습니다.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else if viewModel.authorizationDenied {
                VStack(alignment: .leading, spacing: 8) {
                    Text("동작 및 피트니스 권한이 필요해요.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("설정 > 개인정보 보호 및 보안 > 동작 및 피트니스에서 포실이 권한을 허용해 주세요.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                HStack(alignment: .lastTextBaseline, spacing: 6) {
                    Text(viewModel.todaySteps.formatted())
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)

                    Text("/ \(viewModel.dailyGoal.formatted())보")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(.systemGray5))
                        Capsule()
                            .fill(viewModel.goalReached ? Color.orange : Color.green)
                            .frame(width: geometry.size.width * viewModel.progress)
                    }
                }
                .frame(height: 10)

                HStack {
                    Text("\(viewModel.progressPercent)%")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(viewModel.goalReached ? .orange : .green)

                    Spacer()

                    if viewModel.goalReached {
                        Text("목표 달성!")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.orange)
                    } else {
                        Text("목표까지 \(viewModel.remainingSteps.formatted())보")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.green.opacity(0.2), lineWidth: 1)
        )
    }
}
