import SwiftUI

struct OverlayRootView: View {
    @EnvironmentObject var viewModel: TodoViewModel
    @ObservedObject private var auth = AuthService.shared

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.clear

            if auth.isLoggedIn {
                // 로그인 완료: 캐릭터 + 말풍선
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
            } else {
                // 비로그인: 로그인 창
                LoginView()
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(NSColor.windowBackgroundColor))
                            .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
                    )
                    .padding(8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.clear)
        .onChange(of: auth.isLoggedIn) { loggedIn in
            if loggedIn {
                // 로그인 성공 시 창 크기를 캐릭터 크기로 변경
                NotificationCenter.default.post(name: .authStateChanged, object: loggedIn)
            }
        }
    }
}

