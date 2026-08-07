import SwiftUI

struct FridgeMenuRecommendView: View {
    let ingredients: [FridgeItem]
    @Environment(\.dismiss) private var dismiss

    @State private var isLoading = true
    @State private var errorMessage = ""
    @State private var menus: [RecommendedMenu] = []
    @State private var remainingBalance: Int?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("냉장고 재료로 메뉴를 고르는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 14) {
                            ForEach(menus) { menu in
                                menuCard(menu)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("메뉴 추천")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let remainingBalance {
                    Text("남은 토큰 \(remainingBalance) · 비용 \(Config.menuRecommendTokenCost)토큰")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial)
                }
            }
        }
        .task {
            await recommend()
        }
    }

    private func menuCard(_ menu: RecommendedMenu) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(menu.title)
                .font(.headline)
            if !menu.reason.isEmpty {
                Text(menu.reason)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !menu.usedIngredients.isEmpty {
                Text("사용 재료")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
                FlowChips(items: menu.usedIngredients, tint: .green)
            }

            if !menu.missingIngredients.isEmpty {
                Text("있으면 좋은 재료")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                FlowChips(items: menu.missingIngredients, tint: .orange)
            }

            if !menu.steps.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(menu.steps.enumerated()), id: \.offset) { index, step in
                        Text("\(index + 1). \(step)")
                            .font(.subheadline)
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.green.opacity(0.25), lineWidth: 2)
        )
    }

    @MainActor
    private func recommend() async {
        isLoading = true
        errorMessage = ""
        defer { isLoading = false }

        do {
            let result = try await MenuRecommendService.recommendMenus(from: ingredients)
            menus = result.menus
            remainingBalance = result.remainingBalance
        } catch {
            if !error.isCancellation {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct FlowChips: View {
    let items: [String]
    let tint: Color

    var body: some View {
        FlexibleChipWrap(items: items, tint: tint)
    }
}

/// 간단한 가로 줄바꿈 칩
private struct FlexibleChipWrap: View {
    let items: [String]
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(chunked(items, size: 3), id: \.self) { row in
                HStack(spacing: 6) {
                    ForEach(row, id: \.self) { name in
                        Text(name)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(tint.opacity(0.12))
                            .foregroundStyle(tint)
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    private func chunked(_ values: [String], size: Int) -> [[String]] {
        stride(from: 0, to: values.count, by: size).map {
            Array(values[$0..<min($0 + size, values.count)])
        }
    }
}
