import SwiftUI

/// 여름.png 배경 위에 현재 시각을 크게 보여주는 전체 화면 시계
struct SummerClockView: View {
    private let imageName = "summer"
    /// 탭 등에서 나갈 때 호출 (없으면 뒤로가기 버튼 숨김)
    var onBack: (() -> Void)? = nil

    @State private var now = Date()

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter
    }()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color(red: 207 / 255, green: 232 / 255, blue: 216 / 255)
                    .ignoresSafeArea()

                backgroundImage(size: geometry.size)

                LinearGradient(
                    colors: [
                        Color.black.opacity(0.10),
                        Color.clear,
                        Color.black.opacity(0.15),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                .allowsHitTesting(false)

                clockTexts(size: geometry.size)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .padding(.horizontal, 24)

                if let onBack {
                    backButton
                        .padding(.top, geometry.safeAreaInsets.top + 8)
                        .padding(.leading, 16)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        }
        .ignoresSafeArea()
        .statusBar(hidden: true)
        .persistentSystemOverlays(.hidden)
        .onReceive(timer) { value in
            now = value
        }
    }

    @ViewBuilder
    private func backgroundImage(size: CGSize) -> some View {
        if let uiImage = UIImage(named: imageName) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
                .frame(width: size.width, height: size.height)
                .clipped()
                .ignoresSafeArea()
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private func clockTexts(size: CGSize) -> some View {
        let isLandscape = size.width > size.height
        VStack(spacing: isLandscape ? 6 : 10) {
            Text(Self.dateFormatter.string(from: now))
                .font(.system(size: isLandscape ? 16 : 20, weight: .medium, design: .rounded))
                .foregroundColor(Color.primary.opacity(0.75))
                .shadow(color: .white.opacity(0.55), radius: 4, x: 0, y: 1)

            Text(Self.timeFormatter.string(from: now))
                .font(.system(size: clockFontSize(for: size), weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundColor(Color(red: 0.12, green: 0.12, blue: 0.14))
                .shadow(color: .white.opacity(0.45), radius: 12, x: 0, y: 2)
                .shadow(color: .black.opacity(0.12), radius: 1, x: 0, y: 1)
                .animation(.easeInOut(duration: 0.2), value: Self.timeFormatter.string(from: now))
        }
    }

    private func clockFontSize(for size: CGSize) -> CGFloat {
        let isLandscape = size.width > size.height
        if isLandscape {
            return min(max(size.height * 0.35, 60), 100)
        }
        return min(max(size.width * 0.22, 64), 120)
    }

    private var backButton: some View {
        Button {
            onBack?()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                Text("나가기")
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(Color.primary.opacity(0.88))
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("나가기")
    }
}
