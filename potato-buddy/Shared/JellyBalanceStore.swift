import Foundation

@MainActor
final class JellyBalanceStore: ObservableObject {
    static let shared = JellyBalanceStore()

    @Published private(set) var balance: Int = 0
    @Published private(set) var isLoading = false

    private init() {}

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            balance = try await SupabaseService.shared.getMyJellyBalance()
        } catch {
            // 잔액 조회 실패 시 기존 값을 유지해 UI 깜빡임을 줄입니다.
        }
    }
}
