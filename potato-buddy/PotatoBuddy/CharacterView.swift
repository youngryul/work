import SwiftUI

/// 감자 캐릭터 뷰
/// - 클릭: 말풍선 토글
/// - 드래그: 창 이동
/// - 30초마다 액세서리 이모지 변경
/// - 할일 있을 때 빨간 뱃지 표시
struct CharacterView: View {
    @EnvironmentObject var viewModel: TodoViewModel

    // 액세서리 이모지 목록
    private let accessories: [String] = ["", "💤", "☕", "🎵", "📚", "🌙", "✨", "🔥"]
    @State private var accessoryIndex: Int = 0
    @State private var bounceOffset: CGFloat = 0
    @State private var dragOffset: CGPoint = .zero

    private let charSize: CGFloat = 62

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // 감자 + 액세서리
            ZStack(alignment: .bottomTrailing) {
                Text("🥔")
                    .font(.system(size: charSize))
                    .offset(y: bounceOffset)

                if !accessories[accessoryIndex].isEmpty {
                    Text(accessories[accessoryIndex])
                        .font(.system(size: 22))
                        .offset(x: 8, y: 8)
                }
            }
            .frame(width: 100, height: 100)

            // 뱃지
            if !viewModel.tasks.isEmpty {
                Text("\(viewModel.tasks.count)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.red)
                    .clipShape(Capsule())
                    .padding(10)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            viewModel.toggleBubble()
        }
        .gesture(
            DragGesture()
                .onChanged { value in
                    moveWindow(by: value.translation)
                }
        )
        .onAppear {
            startAccessoryCycle()
            startBounceCycle()
        }
    }

    // MARK: - 드래그로 창 이동

    private func moveWindow(by translation: CGSize) {
        guard let window = NSApp.windows.first(where: { $0 is FloatingWindow }) else { return }
        let screen   = NSScreen.main ?? NSScreen.screens[0]
        let visArea  = screen.visibleFrame
        let newFrame = window.frame.offsetBy(dx: translation.width, dy: -translation.height)

        // 화면 밖 클램프
        let safeX = max(visArea.minX, min(newFrame.origin.x, visArea.maxX - newFrame.width))
        let safeY = max(visArea.minY, min(newFrame.origin.y, visArea.maxY - newFrame.height))

        window.setFrameOrigin(CGPoint(x: safeX, y: safeY))
    }

    // MARK: - 30초마다 액세서리 변경

    private func startAccessoryCycle() {
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.3)) {
                accessoryIndex = (accessoryIndex + 1) % accessories.count
            }
        }
    }

    // MARK: - 아이들 바운스 애니메이션

    private func startBounceCycle() {
        withAnimation(
            .easeInOut(duration: 0.6)
            .repeatForever(autoreverses: true)
        ) {
            bounceOffset = -4
        }
    }
}
