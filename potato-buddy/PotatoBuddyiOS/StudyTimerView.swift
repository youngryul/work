import SwiftUI

/// 포실이 공부 타이머 — 스톱워치 방식 (경과 시간 측정)
struct StudyTimerView: View {
    @StateObject private var viewModel = StudyTimerViewModel()

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            timeDisplay
                .padding(.horizontal, 24)

            Spacer()

            bottomPanel
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(backgroundImage)
        .clipped()
        .overlay(
            viewModel.state != .running
                ? Color.white.opacity(0.30)
                    .allowsHitTesting(false)
                    .animation(.easeInOut(duration: 0.3), value: viewModel.state == .running)
                : nil
        )
    }

    // MARK: - 배경 이미지

    private var backgroundImage: some View {
        Group {
            if let uiImage = UIImage(named: "타이머") {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Color(red: 245/255, green: 237/255, blue: 224/255)
            }
        }
    }

    // MARK: - 시간 표시

    private var timeDisplay: some View {
        VStack(spacing: 10) {
            Text(viewModel.digitalTimeText)
                .font(.system(size: 58, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.4), radius: 8, x: 0, y: 2)
                .contentTransition(.numericText())
                .animation(.easeInOut(duration: 0.2), value: viewModel.digitalTimeText)

            Text(statusLabel)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.white.opacity(0.9))
                .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 1)
        }
        .padding(.vertical, 22)
        .padding(.horizontal, 28)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var statusLabel: String {
        switch viewModel.state {
        case .idle:    return "시작 버튼을 눌러보세요"
        case .running: return "포실이와 함께 집중 중..."
        case .paused:  return "일시정지됨"
        }
    }

    // MARK: - 하단 버튼 패널

    private var bottomPanel: some View {
        VStack(spacing: 10) {
            if let msg = viewModel.savedMessage {
                Text(msg)
                    .font(.subheadline.bold())
                    .foregroundColor(.green)
            }
            if let err = viewModel.saveError {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 10) {
                Button { viewModel.reset() } label: {
                    Text("초기화").frame(maxWidth: .infinity)
                }
                .buttonStyle(TimerSecondaryButtonStyle())

                if viewModel.state == .paused && viewModel.elapsedSeconds > 0 {
                    Button {
                        Task { await viewModel.save() }
                    } label: {
                        Text(viewModel.isSaving ? "저장 중..." : "완료")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(TimerPrimaryButtonStyle(color: .blue))
                    .disabled(viewModel.isSaving)
                }

                Button {
                    switch viewModel.state {
                    case .running:       viewModel.pause()
                    case .idle, .paused: viewModel.start()
                    }
                } label: {
                    Text(primaryActionTitle).frame(maxWidth: .infinity)
                }
                .buttonStyle(TimerPrimaryButtonStyle(color: .green))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var primaryActionTitle: String {
        switch viewModel.state {
        case .running: return "일시정지"
        case .paused:  return "재개"
        case .idle:    return "시작"
        }
    }
}

// MARK: - 버튼 스타일

private struct TimerPrimaryButtonStyle: ButtonStyle {
    var color: Color = .green
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: 12).fill(color.opacity(configuration.isPressed ? 0.75 : 1)))
    }
}

private struct TimerSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.primary)
            .padding(.vertical, 13)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground).opacity(configuration.isPressed ? 0.7 : 1)))
    }
}
