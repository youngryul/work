import SwiftUI

@main
struct PotatoBuddyApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // LSUIElement = true 이므로 메뉴바/독 없이 실행
        // Settings 씬만 등록하여 앱 프로세스를 유지
        Settings {
            EmptyView()
        }
    }
}
