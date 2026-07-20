import Foundation

@MainActor
final class ToeicCompletionViewModel: ObservableObject {
    @Published var completions: [Int: Int] = [:]
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var statusMessage = ""

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let map = try await SupabaseService.shared.fetchToeicDayCompletions()
            completions = map
            ToeicVocabLocalStore.saveCompletions(map)
        } catch {
            completions = ToeicVocabLocalStore.loadCompletions()
            statusMessage = "완료 기록을 서버에서 불러오지 못해 로컬 기록을 사용합니다."
        }
    }

    func count(for day: Int) -> Int {
        completions[day] ?? 0
    }

    private func applyLocal(day: Int, count: Int) {
        var next = completions
        if count <= 0 {
            next.removeValue(forKey: day)
        } else {
            next[day] = count
        }
        completions = next
        ToeicVocabLocalStore.saveCompletions(next)
    }

    func increment(day: Int) async {
        guard !isSaving else { return }
        let optimistic = count(for: day) + 1
        applyLocal(day: day, count: optimistic)
        isSaving = true
        defer { isSaving = false }
        do {
            let saved = try await SupabaseService.shared.incrementToeicDayCompletion(dayNumber: day)
            applyLocal(day: day, count: saved)
            statusMessage = "DAY \(day) · 완료 \(saved)회"
        } catch {
            statusMessage = "저장 실패 — 로컬에만 반영됐습니다."
        }
    }

    func decrement(day: Int) async {
        guard !isSaving else { return }
        let current = count(for: day)
        guard current > 0 else { return }
        let optimistic = current - 1
        applyLocal(day: day, count: optimistic)
        isSaving = true
        defer { isSaving = false }
        do {
            let saved = try await SupabaseService.shared.decrementToeicDayCompletion(dayNumber: day)
            applyLocal(day: day, count: saved)
            statusMessage = saved > 0 ? "DAY \(day) · 완료 \(saved)회" : "DAY \(day) · 완료 기록 삭제"
        } catch {
            statusMessage = "수정 실패 — 로컬에만 반영됐습니다."
        }
    }
}
