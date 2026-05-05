import SwiftUI
import WidgetKit

// MARK: - AppDelegate: URL 토글 및 창 관리

class AppDelegate: NSObject, NSApplicationDelegate {
    /// widget 탭 직전에 앱이 비활성 상태였는지 추적
    private var wasInactiveBeforeURL = false

    func applicationWillBecomeActive(_ notification: Notification) {
        wasInactiveBeforeURL = true
        // URL 핸들러가 호출될 시간(약 0.5s) 이후 리셋
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            self.wasInactiveBeforeURL = false
        }
    }

    /// macOS가 URL 스킴을 받으면 호출 (SwiftUI onOpenURL 대신 사용)
    func application(_ application: NSApplication, open urls: [URL]) {
        guard urls.first?.scheme == "workwidget" else { return }
        DispatchQueue.main.async { self.toggleWindow() }
    }

    private func toggleWindow() {
        guard let window = NSApp.windows.first(where: { !($0 is NSPanel) }) else { return }

        if wasInactiveBeforeURL {
            // 비활성 상태에서 활성화 → 창 표시
            wasInactiveBeforeURL = false
            if !window.isVisible {
                window.makeKeyAndOrderFront(nil)
            }
        } else {
            // 이미 활성 → 창 토글
            if window.isVisible {
                window.orderOut(nil)   // 숨기기 (뷰 유지)
            } else {
                window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
    }

    /// 마지막 창이 닫혀도 앱 종료하지 않음
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

// MARK: - App

@main
struct WorkWidgetApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Window("오늘 할일", id: "main") {
            ContentView()
        }
        .windowResizability(.contentSize)
    }
}
