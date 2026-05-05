import AppKit

/// 투명·테두리 없음·항상 위 부동 창
/// NSPanel + nonactivatingPanel → 다른 앱의 포커스를 빼앗지 않음
final class FloatingWindow: NSPanel {

    init(frame: NSRect) {
        super.init(
            contentRect: frame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing:   .buffered,
            defer:     false
        )
        configure()
    }

    private func configure() {
        // 투명 배경
        backgroundColor       = .clear
        isOpaque              = false
        hasShadow             = false

        // 항상 다른 일반 창 위에 표시
        level                 = .floating

        // 모든 스페이스에 표시, 미션컨트롤에서 제외
        collectionBehavior    = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        // 창 배경 드래그 이동 비활성 (CharacterView 에서 직접 처리)
        isMovableByWindowBackground = false

        // 마우스 이벤트 수신 (캐릭터·버블 클릭을 위해)
        ignoresMouseEvents    = false

        acceptsMouseMovedEvents = true
    }

    // NSPanel 은 기본적으로 canBecomeKey = false 이므로 명시적으로 허용
    override var canBecomeKey:  Bool { true }
    override var canBecomeMain: Bool { false }

    // 투명 배경에서도 마우스 이벤트가 NSHostingView 까지 전달되도록
    override func mouseDown(with event: NSEvent) {
        makeKey()
        super.mouseDown(with: event)
    }
}
