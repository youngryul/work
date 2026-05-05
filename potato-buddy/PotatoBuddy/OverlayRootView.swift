import SwiftUI

/// 전체 오버레이 루트 뷰
/// 하단: 캐릭터 (항상 표시)
/// 상단: 말풍선 (isBubbleVisible == true 일 때 표시)
struct OverlayRootView: View {
    @EnvironmentObject var viewModel: TodoViewModel

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.clear  // 투명 배경

            VStack(spacing: 0) {
                if viewModel.isBubbleVisible {
                    ChatBubbleView()
                        .environmentObject(viewModel)
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.85, anchor: .bottom)
                                    .combined(with: .opacity),
                                removal: .scale(scale: 0.85, anchor: .bottom)
                                    .combined(with: .opacity)
                            )
                        )
                }

                CharacterView()
                    .environmentObject(viewModel)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.clear)
    }
}
