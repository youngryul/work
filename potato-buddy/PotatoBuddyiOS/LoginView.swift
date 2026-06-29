import SwiftUI

struct LoginView: View {
    @State private var showLoginForm = false

    var body: some View {
        if showLoginForm {
            LoginFormView()
        } else {
            WelcomeView(showLoginForm: $showLoginForm)
        }
    }
}

// MARK: - 시작 화면 (배경 이미지 + 시작 버튼)

struct WelcomeView: View {
    @Binding var showLoginForm: Bool

    // 이미지 가장자리 색상과 자연스럽게 이어지는 색
    private let topColor    = Color(red: 142/255, green: 203/255, blue: 238/255) // #8ecbee (하늘색)
    private let bottomColor = Color(red: 162/255, green: 124/255, blue: 70/255)  // #a27c46 (갈색)

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // 상단/하단 배경 그라디언트 (이미지 가장자리와 동일한 색)
                LinearGradient(
                    stops: [
                        .init(color: topColor,    location: 0.0),
                        .init(color: topColor,    location: 0.1),
                        .init(color: bottomColor, location: 0.9),
                        .init(color: bottomColor, location: 1.0),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                // 배경 이미지 - 정중앙 정렬
                if let uiImage = UIImage(named: "모바일배경") {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .frame(width: geo.size.width)
                        .position(x: geo.size.width / 2, y: geo.size.height / 2)
                }

                // 시작하기 버튼
                Button {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showLoginForm = true
                    }
                } label: {
                    Text("시작하기")
                        .font(.system(size: 18, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(16)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 60)
            }
        }
    }
}

// MARK: - 로그인 폼 (흰 배경 + 포실이 + 입력 필드)

struct LoginFormView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // 포실이 이미지
            if let uiImage = UIImage(named: "포실이(투명)") {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 110, height: 110)
            } else {
                Text("🥔")
                    .font(.system(size: 72))
            }

            Text("포실이")
                .font(.system(size: 26, weight: .bold))
                .foregroundColor(.green)
                .padding(.top, 8)

            Spacer().frame(height: 40)

            // 입력 필드
            VStack(spacing: 14) {
                TextField("이메일", text: $email)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)

                SecureField("비밀번호", text: $password)
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
            }
            .padding(.horizontal, 28)

            // 에러 메시지
            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
                    .padding(.top, 10)
            }

            Spacer().frame(height: 24)

            // 로그인 버튼
            Button {
                Task { await signIn() }
            } label: {
                Group {
                    if isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("로그인")
                            .font(.system(size: 17, weight: .semibold))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.green)
                .foregroundColor(.white)
                .cornerRadius(14)
                .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1.0)
            }
            .disabled(isLoading || email.isEmpty || password.isEmpty)
            .padding(.horizontal, 28)

            // 웹 회원가입
            Button {
                UIApplication.shared.open(Config.websiteURL)
            } label: {
                Text("웹에서 회원가입")
                    .font(.footnote)
                    .foregroundColor(.green)
                    .underline()
            }
            .padding(.top, 16)

            Spacer()
        }
        .background(Color.white)
    }

    private func signIn() async {
        isLoading = true
        errorMessage = ""
        do {
            try await AuthService.shared.signIn(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
