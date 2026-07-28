import SwiftUI

/// 코르크 보드 배경 + 나무 프레임
struct CorkBoardBackground: View {
    var body: some View {
        ZStack {
            CorkBoardTheme.corkBase

            // 코르크 알갱이 느낌
            GeometryReader { geo in
                Canvas { context, size in
                    let cols = Int(size.width / 18)
                    let rows = Int(size.height / 18)
                    for row in 0..<rows {
                        for col in 0..<cols {
                            let seed = (row * 31 + col * 17) % 7
                            guard seed != 0 else { continue }
                            let x = CGFloat(col) * 18 + CGFloat(seed)
                            let y = CGFloat(row) * 18 + CGFloat((seed * 3) % 7)
                            let r = CGFloat(1 + seed % 3)
                            var path = Path()
                            path.addEllipse(in: CGRect(x: x, y: y, width: r, height: r))
                            context.fill(
                                path,
                                with: .color(CorkBoardTheme.corkDark.opacity(0.18 + Double(seed) * 0.03))
                            )
                        }
                    }
                }
            }

            // 가장자리 나무 프레임
            RoundedRectangle(cornerRadius: 4)
                .strokeBorder(CorkBoardTheme.woodFrame, lineWidth: 10)
                .padding(4)
                .shadow(color: .black.opacity(0.25), radius: 2, x: 0, y: 1)

            // 안쪽 그림자
            RoundedRectangle(cornerRadius: 2)
                .strokeBorder(Color.black.opacity(0.12), lineWidth: 2)
                .padding(12)
        }
        .ignoresSafeArea()
    }
}

/// 마스킹 테이프 장식
struct MaskingTape: View {
    var width: CGFloat = 72
    var color: Color = CorkBoardTheme.tapeOrange

    var body: some View {
        Capsule()
            .fill(color.opacity(0.85))
            .frame(width: width, height: 14)
            .overlay(
                Capsule()
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
            )
            .rotationEffect(.degrees(-8))
            .shadow(color: .black.opacity(0.15), radius: 1, y: 1)
    }
}

/// 보드 상단 헤더 (이름표 + 포실이)
struct CorkBoardHeader: View {
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .top) {
                    VStack(spacing: 0) {
                        Text("HELLO")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                            .background(CorkBoardTheme.accentBlue)

                        Text(title)
                            .font(.system(size: 22, weight: .heavy, design: .rounded))
                            .foregroundColor(CorkBoardTheme.accentBlue)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .background(Color.white)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .shadow(color: .black.opacity(0.2), radius: 3, y: 2)
                    .overlay(alignment: .top) {
                        MaskingTape(width: 56)
                            .offset(y: -8)
                    }
                }

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            Capsule().fill(CorkBoardTheme.posilyGreen)
                        )
                        .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
                }
            }

            Spacer(minLength: 8)

            posilySticker
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
    }

    private var posilySticker: some View {
        Group {
            if let uiImage = UIImage(named: "포실이(투명)") ?? UIImage(named: "포실이") {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
            } else {
                Text("🥔")
                    .font(.system(size: 52))
            }
        }
        .frame(width: 72, height: 72)
        .padding(6)
        .background(
            Circle()
                .fill(Color.white)
                .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
        )
        .overlay(alignment: .topTrailing) {
            Circle()
                .fill(CorkBoardTheme.accentYellow)
                .frame(width: 14, height: 14)
                .overlay(Circle().stroke(Color.white, lineWidth: 1))
                .offset(x: 2, y: -2)
        }
        .rotationEffect(.degrees(6))
    }
}

/// 보드에 꽂힌 스티커 메모 카드
struct BoardStickyNoteCard<Accessory: View>: View {
    let id: String
    let title: String
    let caption: String?
    let captionColor: Color
    let noteColor: Color?
    let isStruckThrough: Bool
    let showPrimaryAction: Bool
    let onPrimary: () -> Void
    let onCardTap: (() -> Void)?
    let primarySystemImage: String
    let primaryTint: Color
    @ViewBuilder var accessory: () -> Accessory

    init(
        id: String,
        title: String,
        caption: String? = nil,
        captionColor: Color = .secondary,
        noteColor: Color? = nil,
        isStruckThrough: Bool = false,
        showPrimaryAction: Bool = true,
        primarySystemImage: String = "checkmark.circle.fill",
        primaryTint: Color = CorkBoardTheme.posilyGreen,
        onPrimary: @escaping () -> Void = {},
        onCardTap: (() -> Void)? = nil,
        @ViewBuilder accessory: @escaping () -> Accessory
    ) {
        self.id = id
        self.title = title
        self.caption = caption
        self.captionColor = captionColor
        self.noteColor = noteColor
        self.isStruckThrough = isStruckThrough
        self.showPrimaryAction = showPrimaryAction
        self.primarySystemImage = primarySystemImage
        self.primaryTint = primaryTint
        self.onPrimary = onPrimary
        self.onCardTap = onCardTap
        self.accessory = accessory
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            accessory()

            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundColor(
                        isStruckThrough
                            ? Color(red: 0.45, green: 0.42, blue: 0.38)
                            : Color(red: 0.18, green: 0.16, blue: 0.14)
                    )
                    .strikethrough(isStruckThrough, color: Color(red: 0.35, green: 0.32, blue: 0.28))
                    .fixedSize(horizontal: false, vertical: true)

                if let caption, !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(captionColor)
                        .strikethrough(isStruckThrough, color: captionColor.opacity(0.7))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .opacity(isStruckThrough ? 0.65 : 1)

            if showPrimaryAction {
                Button(action: onPrimary) {
                    Image(systemName: primarySystemImage)
                        .font(.title3.weight(.semibold))
                        .foregroundColor(primaryTint)
                        .padding(8)
                        .background(Circle().fill(Color.white.opacity(0.75)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 18)
        .padding(.horizontal, 14)
        .padding(.bottom, 14)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(noteColor ?? CorkBoardTheme.stickyColor(for: id))
                .shadow(color: .black.opacity(0.22), radius: 4, x: 1, y: 3)
        )
        .overlay(alignment: .top) {
            Circle()
                .fill(CorkBoardTheme.accentBlue)
                .frame(width: 12, height: 12)
                .overlay(Circle().fill(Color.white.opacity(0.35)).frame(width: 4, height: 4).offset(x: -1, y: -1))
                .shadow(color: .black.opacity(0.3), radius: 1, y: 1)
                .offset(y: -2)
        }
        .rotationEffect(.degrees(CorkBoardTheme.tilt(for: id)))
        .padding(.horizontal, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            onCardTap?()
        }
        .animation(.easeInOut(duration: 0.2), value: isStruckThrough)
    }
}

extension BoardStickyNoteCard where Accessory == EmptyView {
    init(
        id: String,
        title: String,
        caption: String? = nil,
        captionColor: Color = .secondary,
        noteColor: Color? = nil,
        isStruckThrough: Bool = false,
        showPrimaryAction: Bool = true,
        primarySystemImage: String = "checkmark.circle.fill",
        primaryTint: Color = CorkBoardTheme.posilyGreen,
        onPrimary: @escaping () -> Void = {},
        onCardTap: (() -> Void)? = nil
    ) {
        self.init(
            id: id,
            title: title,
            caption: caption,
            captionColor: captionColor,
            noteColor: noteColor,
            isStruckThrough: isStruckThrough,
            showPrimaryAction: showPrimaryAction,
            primarySystemImage: primarySystemImage,
            primaryTint: primaryTint,
            onPrimary: onPrimary,
            onCardTap: onCardTap,
            accessory: { EmptyView() }
        )
    }
}

/// 빈 보드 안내
struct CorkBoardEmptyState: View {
    let message: String
    let hint: String

    var body: some View {
        VStack(spacing: 14) {
            Group {
                if let uiImage = UIImage(named: "포실이(투명)") ?? UIImage(named: "포실이") {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 96, height: 96)
                } else {
                    Text("🥔").font(.system(size: 64))
                }
            }
            .padding(10)
            .background(Circle().fill(Color.white))
            .shadow(color: .black.opacity(0.18), radius: 4, y: 2)

            Text(message)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 0.2, green: 0.18, blue: 0.15))

            Text(hint)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(red: 0.35, green: 0.3, blue: 0.25))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(CorkBoardTheme.stickyCream)
                .shadow(color: .black.opacity(0.2), radius: 5, y: 3)
        )
        .overlay(alignment: .top) {
            MaskingTape(width: 80, color: CorkBoardTheme.accentYellow)
                .offset(y: -8)
        }
        .rotationEffect(.degrees(-2))
        .padding(.horizontal, 28)
        .padding(.top, 40)
    }
}
