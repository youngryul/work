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
    @ObservedObject private var bgm = TimerBgmPlayer.shared
    @Environment(\.scenePhase) private var scenePhase

    @State private var isSaving = false
    @State private var saveMessage: String?
    @State private var saveError: String?

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

                // 저장 완료 / 에러
                if let msg = saveMessage {
                    Text(msg)
                        .font(.subheadline.bold())
                        .foregroundColor(.green)
                }
                if let err = saveError {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }

                Spacer(minLength: 12)
            }
            .navigationTitle("뽀모도로")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    TimerBgmToggleButton()
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                viewModel.syncWhenAppBecomesActive()
            }
        }
        .onDisappear {
            bgm.stopAndTurnOff()
        }
    }

    // MARK: - 이미지

    private var pomodoroImage: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height)

            ZStack {
                Group {
                    if let uiImage = UIImage(named: imageName) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFit()
                    } else {
                        Text("🥔").font(.system(size: size * 0.5))
                    }
                }
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

    // MARK: - 상태 텍스트

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
                Text("수고했어요! 기록을 저장해보세요 🎉")
            }
        }
        .font(.subheadline)
        .foregroundColor(.secondary)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
    }

    // MARK: - 시간 선택

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

    // MARK: - 컨트롤 버튼

    private var controlButtons: some View {
        HStack(spacing: 12) {
            Button {
                viewModel.reset()
                saveMessage = nil
                saveError = nil
            } label: {
                Label("초기화", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PomodoroSecondaryButtonStyle())

            // 완료 상태일 때 저장 버튼
            if viewModel.state == .finished {
                Button {
                    Task { await saveSession() }
                } label: {
                    Label(isSaving ? "저장 중..." : "기록 저장", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PomodoroPrimaryButtonStyle(color: .blue))
                .disabled(isSaving)
            }

            Button {
                saveMessage = nil
                saveError = nil
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
        case .running:           return "일시정지"
        case .paused:            return "재개"
        case .finished:          return "다시 시작"
        case .idle:              return "시작"
        }
    }

    private var primaryActionIcon: String {
        switch viewModel.state {
        case .running: return "pause.fill"
        default:       return "play.fill"
        }
    }

    // MARK: - 저장

    private func saveSession() async {
        let secs = viewModel.elapsedSeconds
        guard secs > 0 else { return }
        isSaving = true
        saveMessage = nil
        saveError = nil
        do {
            try await SupabaseService.shared.addStudySession(seconds: secs, source: "pomodoro")
            saveMessage = "\(formatStudyDuration(secs)) 기록 완료! 🎉"
            viewModel.reset()
        } catch {
            saveError = error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - 버튼 스타일

private struct PomodoroPrimaryButtonStyle: ButtonStyle {
    var color: Color = .green

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(color.opacity(configuration.isPressed ? 0.75 : 1))
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
