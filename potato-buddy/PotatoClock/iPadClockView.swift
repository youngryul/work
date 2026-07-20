import SwiftUI

struct iPadClockView: View {
    @State private var now = Date()

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 EEEE"
        return f
    }()

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                // 배경색
                Color(red: 207 / 255, green: 232 / 255, blue: 216 / 255)
                    .ignoresSafeArea()

                // 배경 이미지
                if let uiImage = UIImage(named: "summer") {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped()
                        .ignoresSafeArea()
                        .allowsHitTesting(false)
                }

                // 그라디언트 오버레이
                LinearGradient(
                    colors: [
                        Color.black.opacity(0.20),
                        Color.black.opacity(0.05),
                        Color.clear,
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                .allowsHitTesting(false)

                // 시계 — 상단 배치
                VStack(alignment: .center, spacing: 8) {
                    Text(Self.dateFormatter.string(from: now))
                        .font(.system(size: dateFontSize(for: geometry.size), weight: .medium, design: .rounded))
                        .foregroundColor(Color.white.opacity(0.90))
                        .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)

                    Text(Self.timeFormatter.string(from: now))
                        .font(.system(size: clockFontSize(for: geometry.size), weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(Color.white)
                        .shadow(color: .black.opacity(0.30), radius: 8, x: 0, y: 3)
                        .animation(.easeInOut(duration: 0.2), value: Self.timeFormatter.string(from: now))
                }
                .padding(.top, topPadding(for: geometry.size))
                .frame(maxWidth: .infinity)
            }
        }
        .ignoresSafeArea()
        .statusBar(hidden: true)
        .onReceive(timer) { value in
            now = value
        }
    }

    private func clockFontSize(for size: CGSize) -> CGFloat {
        let shorter = min(size.width, size.height)
        return min(max(shorter * 0.18, 80), 200)
    }

    private func dateFontSize(for size: CGSize) -> CGFloat {
        let shorter = min(size.width, size.height)
        return min(max(shorter * 0.04, 22), 42)
    }

    private func topPadding(for size: CGSize) -> CGFloat {
        size.height * 0.08
    }
}
