import SwiftUI

struct JellyBalanceBadgeView: View {
    @EnvironmentObject private var jellyStore: JellyBalanceStore

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "shippingbox.fill")
                .font(.caption)
                .foregroundColor(.orange)
            Text(jellyStore.balance.formatted())
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.primary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}
