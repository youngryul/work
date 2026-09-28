import SwiftUI

struct WatchHomeView: View {
    @EnvironmentObject private var session: WatchSessionManager
    @State private var path: [WatchFeature] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if session.credentials == nil {
                    NotLinkedView()
                } else {
                    List(WatchFeature.allCases) { feature in
                        NavigationLink(value: feature) {
                            Label(feature.title, systemImage: feature.systemImage)
                                .foregroundStyle(feature.tint)
                        }
                    }
                }
            }
            .navigationTitle("포실이")
            .navigationDestination(for: WatchFeature.self) { feature in
                feature.destination
            }
        }
        .onOpenURL { url in
            // 컴플리케이션 탭 시 해당 기능 화면으로 바로 이동
            guard session.credentials != nil, let feature = WatchFeature(url: url) else { return }
            path = [feature]
        }
    }
}

/// 폰에서 로그인 세션을 아직 받지 못한 상태
private struct NotLinkedView: View {
    @EnvironmentObject private var session: WatchSessionManager
    @State private var isRequesting = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("🥔")
                    .font(.system(size: 40))
                Text("아이폰의 포실이 앱에서 로그인하면 자동으로 연결돼요.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)

                Button {
                    Task { await requestSession() }
                } label: {
                    if isRequesting {
                        ProgressView()
                    } else {
                        Text("다시 연결")
                    }
                }
                .disabled(isRequesting)

                if let message {
                    Text(message)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .task {
            // 처음 열었을 때 폰에 세션을 한 번 요청
            await requestSession()
        }
    }

    private func requestSession() async {
        isRequesting = true
        defer { isRequesting = false }
        do {
            try await session.requestFreshSession(staleToken: nil)
            message = nil
        } catch {
            message = error.localizedDescription
        }
    }
}
