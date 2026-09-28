import SwiftUI
import UIKit

@main
struct PotatoBuddyiOSApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // 워치 요청으로 백그라운드 실행될 때도 응답할 수 있도록 실행 직후 활성화
        PhoneWatchConnector.shared.activate()
        return true
    }
}
