import SwiftUI
import AppKit

// MARK: - 애니메이션 GIF 뷰 (NSImageView 래퍼)

struct AnimatedImageView: NSViewRepresentable {
    let name: String   // Assets에 있는 파일명 (확장자 제외)

    func makeNSView(context: Context) -> NSImageView {
        let view = NSImageView()
        view.imageScaling = .scaleProportionallyUpOrDown
        view.animates     = true
        if let url = Bundle.main.url(forResource: name, withExtension: "gif"),
           let image = NSImage(contentsOf: url) {
            view.image = image
        }
        return view
    }

    func updateNSView(_ nsView: NSImageView, context: Context) {}
}

// MARK: - 감자 캐릭터 뷰
/// - 클릭: 말풍선 토글
/// - 드래그: 창 이동
/// - 할일 있을 때 빨간 뱃지 표시
struct CharacterView: View {
    @EnvironmentObject var viewModel: TodoViewModel

    @State private var dragOffset: CGPoint = .zero

    var body: some View {
        ZStack(alignment: .topTrailing) {
            AnimatedImageView(name: "물 주는 포실이")
                .frame(width: 100, height: 100)

            // 뱃지 (오른쪽 상단)
            if !viewModel.tasks.isEmpty {
                Text("\(viewModel.tasks.count)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.red)
                    .clipShape(Capsule())
                    .offset(x: 6, y: -6)
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

}
