import SwiftUI

struct LoginView: View {
    @StateObject private var auth = AuthService.shared

    @State private var email     = ""
    @State private var password  = ""
    @State private var isLoading = false
    @State private var errorMsg: String?

    var body: some View {
        VStack(spacing: 14) {
            // 포실이 이미지
            if let img = NSImage(named: "포실이(투명)") {
                Image(nsImage: img)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 64, height: 64)
            } else {
                Text("🥔").font(.system(size: 48))
            }

            Text("포실이")
                .font(.system(size: 15, weight: .bold))

            VStack(spacing: 8) {
                TextField("이메일", text: $email)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(8)
                    .font(.system(size: 13))

                SecureField("비밀번호", text: $password)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(8)
                    .font(.system(size: 13))
                    .onSubmit { Task { await login() } }
            }

            if let msg = errorMsg {
                Text(msg)
                    .font(.system(size: 11))
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: { Task { await login() } }) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(maxWidth: .infinity)
                        .frame(height: 30)
                } else {
                    Text("로그인")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 30)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(isLoading || email.isEmpty || password.isEmpty)

            Divider()

            VStack(spacing: 6) {
                Text("처음 사용하신다면 웹에서\n회원가입을 진행해주세요.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button(action: openWebSite) {
                    Text("웹에서 회원가입")
                        .font(.system(size: 12, weight: .medium))
                        .frame(maxWidth: .infinity)
                        .frame(height: 28)
                }
                .buttonStyle(.bordered)
                .tint(.green)
            }
        }
        .padding(20)
        .frame(width: 240)
    }

    private func openWebSite() {
        NSWorkspace.shared.open(Config.websiteURL)
    }

    private func login() async {
        isLoading = true
        errorMsg  = nil
        do {
            try await auth.signIn(email: email, password: password)
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }
}
