import Foundation
import AVFoundation

/// iOS: 번들에 `timer-bgm.mp3` 를 추가하세요 (PotatoBuddyiOS/timer-bgm.mp3)
enum TimerBgmConstants {
    static let fileName = "timer-bgm"
    static let fileExtension = "mp3"
    static let enabledUserDefaultsKey = "posily_timer_bgm_enabled"
    static let defaultVolume: Float = 0.7
}

@MainActor
final class TimerBgmPlayer: ObservableObject {
    static let shared = TimerBgmPlayer()

    @Published var isEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isEnabled, forKey: TimerBgmConstants.enabledUserDefaultsKey)
            syncPlayback()
        }
    }

    private var player: AVAudioPlayer?

    private init() {
        isEnabled = UserDefaults.standard.bool(forKey: TimerBgmConstants.enabledUserDefaultsKey)
        preparePlayer()
        configureAudioSession()
    }

    func toggle() {
        isEnabled.toggle()
    }

    /// 화면 이탈 시 재생만 멈춤 (ON 설정은 유지하지 않고 OFF로 맞춤)
    func stopAndTurnOff() {
        player?.pause()
        if isEnabled {
            isEnabled = false
        }
    }

    private func preparePlayer() {
        guard let url = Bundle.main.url(
            forResource: TimerBgmConstants.fileName,
            withExtension: TimerBgmConstants.fileExtension
        ) else {
            player = nil
            return
        }

        do {
            let audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer.numberOfLoops = -1 // 무한 반복
            audioPlayer.volume = TimerBgmConstants.defaultVolume
            audioPlayer.prepareToPlay()
            player = audioPlayer
        } catch {
            player = nil
        }
    }

    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // ignore
        }
    }

    private func syncPlayback() {
        guard let player else { return }

        if isEnabled {
            player.numberOfLoops = -1
            if !player.isPlaying {
                player.play()
            }
        } else if player.isPlaying {
            player.pause()
        }
    }
}
