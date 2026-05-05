import AppKit
import SwiftUI
import Combine
import ServiceManagement

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var window: FloatingWindow!
    private var viewModel: TodoViewModel!
    private var cancellables = Set<AnyCancellable>()
    private var statusItem: NSStatusItem!

    // MARK: - 앱 시작

    func applicationDidFinishLaunching(_ notification: Notification) {
        viewModel = TodoViewModel()
        setupStatusItem()
        setupWindow()
        observeBubbleToggle()
    }

    // MARK: - 메뉴바 아이콘

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "circle.fill",
                                   accessibilityDescription: "포실이")
            button.image?.isTemplate = true
            // 감자 이모지를 이미지 대신 텍스트로 표시
            button.title = "🥔"
            button.image = nil
        }

        let menu = NSMenu()
        menu.addItem(withTitle: "포실이 보기 / 숨기기",
                     action: #selector(toggleWindow),
                     keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "로그인 시 자동 시작",
                     action: #selector(toggleLaunchAtLogin),
                     keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "종료",
                     action: #selector(NSApplication.terminate(_:)),
                     keyEquivalent: "q")

        statusItem.menu = menu
    }

    @objc private func toggleWindow() {
        guard let window else { return }
        if window.isVisible {
            window.orderOut(nil)
        } else {
            window.orderFrontRegardless()
        }
    }

    @objc private func toggleLaunchAtLogin() {
        // macOS 13+ SMAppService 사용
        if #available(macOS 13.0, *) {
            let service = SMAppService.mainApp
            if service.status == .enabled {
                try? service.unregister()
            } else {
                try? service.register()
            }
        }
    }

    // MARK: - 창 생성

    private func setupWindow() {
        // 초기 상태: 캐릭터만 표시 (100×100)
        let screen   = NSScreen.main ?? NSScreen.screens[0]
        let visArea  = screen.visibleFrame
        let initSize = CGSize(width: 120, height: 120)

        let origin = CGPoint(
            x: visArea.maxX - initSize.width  - 16,
            y: visArea.minY + 16
        )

        window = FloatingWindow(frame: NSRect(origin: origin, size: initSize))

        let rootView = OverlayRootView()
            .environmentObject(viewModel)

        window.contentView = NSHostingView(rootView: rootView)
        window.orderFrontRegardless()
    }

    // MARK: - 버블 토글 → 창 크기 변경

    @MainActor private func observeBubbleToggle() {
        viewModel.$isBubbleVisible
            .receive(on: RunLoop.main)
            .sink { [weak self] visible in
                self?.resizeWindow(bubbleVisible: visible)
            }
            .store(in: &cancellables)
    }

    private func resizeWindow(bubbleVisible: Bool) {
        guard let window else { return }

        let screen   = NSScreen.main ?? NSScreen.screens[0]
        let visArea  = screen.visibleFrame

        let newSize: CGSize = bubbleVisible
            ? CGSize(width: 320, height: 540)
            : CGSize(width: 120, height: 120)

        // 우하단 고정: x, bottom-y 기준으로 origin 재계산
        let currentFrame = window.frame
        let anchorX      = currentFrame.maxX   // 우측 고정
        let anchorY      = currentFrame.minY   // 하단 고정

        let newOrigin = CGPoint(
            x: anchorX - newSize.width,
            y: anchorY
        )

        // 화면 밖으로 나가지 않도록 클램프
        let safeX = max(visArea.minX, min(newOrigin.x, visArea.maxX - newSize.width))
        let safeY = max(visArea.minY, min(newOrigin.y, visArea.maxY - newSize.height))

        let newFrame = NSRect(
            x: safeX, y: safeY,
            width: newSize.width, height: newSize.height
        )

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.28
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            window.animator().setFrame(newFrame, display: true)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
