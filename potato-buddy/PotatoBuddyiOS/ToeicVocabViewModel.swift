import Foundation

@MainActor
final class ToeicVocabViewModel: ObservableObject {
    @Published private(set) var vocab: ToeicVocabData = .empty
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        if let cached = ToeicVocabLocalStore.loadCatalogCache() {
            vocab = cached
        } else {
            let bundled = ToeicVocabData.load()
            if bundled.wordCount > 0 {
                vocab = bundled
            }
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let rows = try await SupabaseService.shared.fetchToeicVocabCatalog()
            guard !rows.isEmpty else {
                if vocab.wordCount == 0 {
                    errorMessage = "등록된 단어가 없습니다. 관리자에게 문의하세요."
                }
                return
            }
            let remote = ToeicVocabData.fromCatalogRows(rows)
            vocab = remote
            ToeicVocabLocalStore.saveCatalogCache(remote)
            errorMessage = nil
        } catch {
            if vocab.wordCount == 0 {
                errorMessage = error.localizedDescription
            }
        }
    }
}
