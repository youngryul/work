import SwiftUI

private struct ClockwiseWhiteFillShape: Shape {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = hypot(rect.width, rect.height) / 2
        var path = Path()
        path.move(to: center)
        path.addArc(
            center: center,
            radius: radius,
            startAngle: .degrees(-90),
            endAngle: .degrees(-90 + 360 * Double(progress)),
            clockwise: false
        )
        path.closeSubpath()
        return path
    }
}

struct PomodoroView: View {
    @StateObject private var viewModel = PomodoroTimerViewModel()
    @Environment(\.scenePhase) private var scenePhase

    private let imageName = "포실이뽀모도로"

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer(minLength: 8)

                pomodoroImage
                    .frame(maxWidth: 280, maxHeight: 280)
                    .padding(.horizontal, 24)

                Text(viewModel.digitalTimeText)
                    .font(.system(size: 56, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(viewModel.state == .finished ? .green : .primary)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.2), value: viewModel.digitalTimeText)

                statusText

                durationPicker
                    .padding(.horizontal, 20)

                controlButtons
                    .padding(.horizontal, 20)

                Spacer(minLength: 12)
            }
            .navigationTitle("뽀모도로")
            .navigationBarTitleDisplayMode(.large)
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                viewModel.syncWhenAppBecomesActive()
            }
        }
    }

    private var pomodoroImage: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height)

            ZStack {
                Image(imageName)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size, height: size)

                Color.white
                    .opacity(0.92)
                    .frame(width: size, height: size)
                    .mask(
                        ClockwiseWhiteFillShape(progress: CGFloat(viewModel.progress))
                            .frame(width: size, height: size)
                    )
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .animation(.linear(duration: 0.05), value: viewModel.progress)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private var statusText: some View {
        Group {
            switch viewModel.state {
            case .idle:
                Text("집중 시간을 선택하고 시작해보세요")
            case .running:
                Text("포실이와 함께 집중 중...")
            case .paused:
                Text("일시정지됨")
            case .finished:
                Text("수고했어요! 휴식을 취해보세요")
            }
        }
        .font(.subheadline)
        .foregroundColor(.secondary)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
    }

    private var durationPicker: some View {
        HStack(spacing: 10) {
            ForEach(PomodoroDuration.allCases) { duration in
                let isSelected = viewModel.selectedMinutes == duration.rawValue

                Button {
                    viewModel.selectDuration(duration.rawValue)
                } label: {
                    Text(duration.label)
                        .font(.subheadline)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundColor(isSelected ? .white : .primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(isSelected ? Color.green : Color(.secondarySystemBackground))
                        )
                }
                .disabled(!viewModel.canChangeDuration)
                .opacity(viewModel.canChangeDuration ? 1 : 0.5)
            }
        }
    }

    private var controlButtons: some View {
        HStack(spacing: 12) {
            Button {
                viewModel.reset()
            } label: {
                Label("초기화", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PomodoroSecondaryButtonStyle())

            Button {
                switch viewModel.state {
                case .running:
                    viewModel.pause()
                case .idle, .paused, .finished:
                    viewModel.start()
                }
            } label: {
                Label(primaryActionTitle, systemImage: primaryActionIcon)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PomodoroPrimaryButtonStyle())
        }
    }

    private var primaryActionTitle: String {
        switch viewModel.state {
        case .running:
            return "일시정지"
        case .paused:
            return "재개"
        case .finished:
            return "다시 시작"
        case .idle:
            return "시작"
        }
    }

    private var primaryActionIcon: String {
        switch viewModel.state {
        case .running:
            return "pause.fill"
        default:
            return "play.fill"
        }
    }
}

private struct PomodoroPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.green.opacity(configuration.isPressed ? 0.75 : 1))
            )
    }
}

private struct PomodoroSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.primary)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.secondarySystemBackground).opacity(configuration.isPressed ? 0.7 : 1))
            )
    }
}
