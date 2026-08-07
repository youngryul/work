import SwiftUI

/// 실제 냉장고 사진 위에 재료 스티커를 올리는 선반 뷰
struct FridgeShelfView: View {
    let zone: FridgeZone
    let items: [FridgeItem]
    var onItemTap: (FridgeItem) -> Void

    /// 사진 기준 선반·서랍 슬롯 (top / height 비율)
    private let shelfSlots: [(top: CGFloat, height: CGFloat)] = [
        (0.12, 0.17),
        (0.31, 0.17),
        (0.50, 0.17),
    ]
    private let drawerTop: CGFloat = 0.70
    private let drawerHeight: CGFloat = 0.24

    private var distributed: (shelves: [[FridgeItem]], left: [FridgeItem], right: [FridgeItem]) {
        var shelves = Array(repeating: [FridgeItem](), count: shelfSlots.count)
        var left: [FridgeItem] = []
        var right: [FridgeItem] = []
        let slotCount = shelfSlots.count + 1

        for (index, item) in items.enumerated() {
            let slot = index % slotCount
            if slot < shelfSlots.count {
                shelves[slot].append(item)
            } else if left.count <= right.count {
                left.append(item)
            } else {
                right.append(item)
            }
        }
        return (shelves, left, right)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(zone.label) 미리보기")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(items.isEmpty ? "비어 있음" : "\(items.count)개 · 탭하여 수정")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            GeometryReader { geo in
                let width = geo.size.width
                let height = geo.size.height
                let layout = distributed

                ZStack(alignment: .topLeading) {
                    Image("FridgeInterior")
                        .resizable()
                        .scaledToFill()
                        .frame(width: width, height: height)
                        .clipped()

                    zoneTint
                        .frame(width: width, height: height)
                        .allowsHitTesting(false)

                    ForEach(Array(shelfSlots.enumerated()), id: \.offset) { index, slot in
                        shelfRow(items: layout.shelves[index], compact: false)
                            .frame(width: width * 0.84, height: height * slot.height, alignment: .bottom)
                            .position(
                                x: width * 0.5,
                                y: height * (slot.top + slot.height * 0.5)
                            )
                    }

                    HStack(spacing: 8) {
                        shelfRow(items: layout.left, compact: true)
                            .frame(maxWidth: .infinity)
                        shelfRow(items: layout.right, compact: true)
                            .frame(maxWidth: .infinity)
                    }
                    .frame(width: width * 0.84, height: height * drawerHeight, alignment: .center)
                    .position(
                        x: width * 0.5,
                        y: height * (drawerTop + drawerHeight * 0.5)
                    )
                }
                .frame(width: width, height: height)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(borderColor, lineWidth: 3)
                )
                .shadow(color: .black.opacity(0.12), radius: 6, y: 3)
            }
            .aspectRatio(525 / 900, contentMode: .fit)
        }
    }

    private func shelfRow(items: [FridgeItem], compact: Bool) -> some View {
        HStack(alignment: .bottom, spacing: compact ? 4 : 6) {
            ForEach(items) { item in
                sticker(item, compact: compact)
            }
        }
    }

    private func sticker(_ item: FridgeItem, compact: Bool) -> some View {
        let icon = FridgeItemIcons.resolve(name: item.name)
        return Button {
            onItemTap(item)
        } label: {
            VStack(spacing: 2) {
                Text(icon.emoji)
                    .font(.system(size: compact ? 18 : 22))
                Text(item.name)
                    .font(.system(size: compact ? 7 : 8, weight: .medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }
            .frame(width: compact ? 40 : 48)
            .padding(.vertical, compact ? 3 : 4)
            .padding(.horizontal, 2)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.93))
                    .shadow(color: .black.opacity(0.1), radius: 2, y: 1)
            )
            .overlay(alignment: .topTrailing) {
                if item.quantity > 1 {
                    Text("\(item.quantity)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.green))
                        .offset(x: 4, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var zoneTint: Color {
        switch zone {
        case .freezer: return Color.cyan.opacity(0.22)
        case .pantry: return Color.orange.opacity(0.2)
        case .fridge: return Color.green.opacity(0.1)
        }
    }

    private var borderColor: Color {
        switch zone {
        case .freezer: return Color.cyan.opacity(0.55)
        case .pantry: return Color.orange.opacity(0.55)
        case .fridge: return Color.green.opacity(0.45)
        }
    }
}
