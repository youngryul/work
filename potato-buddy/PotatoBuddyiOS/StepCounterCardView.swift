import SwiftUI

struct StepCounterCardView: View {
    @ObservedObject var viewModel: StepCounterViewModel
    var onJellyEarned: ((String) -> Void)?
    var onClaimError: ((String) -> Void)?

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

                stepMilestoneJellySection
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

    private var stepMilestoneJellySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider()
                .padding(.vertical, 2)

            ForEach(StepCounterConstants.jellyMilestones) { milestone in
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(milestone.steps.formatted())보")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(
                            viewModel.isMilestoneReached(milestone.steps) ? .primary : .secondary
                        )

                    milestoneJellyButton(milestone)
                }
            }
        }
    }

    @ViewBuilder
    private func milestoneJellyButton(_ milestone: StepJellyMilestone) -> some View {
        let reached = viewModel.isMilestoneReached(milestone.steps)
        let claimed = viewModel.isMilestoneClaimed(milestone.steps)
        let isClaiming = viewModel.claimingMilestoneSteps == milestone.steps

        if claimed {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("젤리 \(milestone.jellyAmount)개 받음")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        } else if reached {
            Button {
                Task { await claimMilestone(milestone) }
            } label: {
                HStack(spacing: 8) {
                    Text("🍮")
                    Text("젤리 +\(milestone.jellyAmount) 받기")
                        .fontWeight(.semibold)
                    Spacer()
                    if isClaiming {
                        ProgressView()
                            .scaleEffect(0.85)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)
                    }
                }
                .font(.subheadline)
                .foregroundColor(.primary)
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .background(Color.orange.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(isClaiming)
        } else {
            HStack(spacing: 8) {
                Text("🍮")
                    .opacity(0.45)
                Text("달성 시 젤리 +\(milestone.jellyAmount)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func claimMilestone(_ milestone: StepJellyMilestone) async {
        do {
            if let awarded = try await viewModel.claimJelly(forMilestoneSteps: milestone.steps), awarded > 0 {
                onJellyEarned?("젤리 +\(awarded)을 획득했어요.")
            }
        } catch {
            onClaimError?(error.localizedDescription)
        }
    }
}
