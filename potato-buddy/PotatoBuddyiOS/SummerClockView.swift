import SwiftUI

/// 여름.png 배경 위에 현재 시각을 크게 보여주는 전체 화면 시계
struct SummerClockView: View {
    private let imageName = "summer"

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

                if geometry.size.width > geometry.size.height {
                    // 가로 모드: 시계를 화면 중앙에 배치
                    clockTexts(size: geometry.size)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    // 세로 모드: 시계를 상단에 배치
                    clockTexts(size: geometry.size)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .padding(.top, geometry.size.height * 0.12)
                        .padding(.horizontal, 24)
                }
            }
        }
        .ignoresSafeArea()
        .statusBarHidden(true)
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
                .foregroundStyle(Color.primary.opacity(0.75))
                .shadow(color: .white.opacity(0.55), radius: 4, x: 0, y: 1)

            Text(Self.timeFormatter.string(from: now))
                .font(.system(size: clockFontSize(for: size), weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.14))
                .shadow(color: .white.opacity(0.45), radius: 12, x: 0, y: 2)
                .shadow(color: .black.opacity(0.12), radius: 1, x: 0, y: 1)
                .contentTransition(.numericText())
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
}
