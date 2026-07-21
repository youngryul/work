import SwiftUI

struct TimerBgmToggleButton: View {
    @ObservedObject private var bgm = TimerBgmPlayer.shared

    var body: some View {
        Button {
            bgm.toggle()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: bgm.isEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                Text(bgm.isEnabled ? "음악 ON" : "음악 OFF")
                    .font(.caption.weight(.semibold))
            }
            .foregroundColor(bgm.isEnabled ? .white : .secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(bgm.isEnabled ? Color.green : Color(.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(bgm.isEnabled ? "배경음악 끄기" : "배경음악 켜기")
    }
}
