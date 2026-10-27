import Foundation

/// 필기 노트 로컬 저장소
/// - 필기 원본(.drawing)은 Application Support에 두어 업로드 전에 앱이 꺼져도 남게 한다.
/// - Storage에서 받은 파일(미리보기·사진·PDF)은 Caches에 버전별로 보관한다.
enum NotebookFileCache {
    /// 동기화 메타: pageId → ["u": 마지막으로 맞춘 서버 updated_at, "d": 업로드 안 된 변경 여부]
    private static let syncMetaKey = "notebook.sync.meta"

    private static var drawingsDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return ensureDirectory(base.appendingPathComponent("NotebookDrawings", isDirectory: true))
    }

    private static var filesDirectory: URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return ensureDirectory(base.appendingPathComponent("NotebookFiles", isDirectory: true))
    }

    private static func ensureDirectory(_ url: URL) -> URL {
        if !FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }
        return url
    }

    // MARK: 필기 원본

    private static func drawingURL(pageId: String) -> URL {
        drawingsDirectory.appendingPathComponent("\(pageId).drawing")
    }

    static func loadDrawing(pageId: String) -> Data? {
        try? Data(contentsOf: drawingURL(pageId: pageId))
    }

    static func saveDrawing(_ data: Data, pageId: String) {
        try? data.write(to: drawingURL(pageId: pageId), options: .atomic)
    }

    // MARK: 동기화 메타

    private static var syncMeta: [String: [String: Any]] {
        get { UserDefaults.standard.dictionary(forKey: syncMetaKey) as? [String: [String: Any]] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: syncMetaKey) }
    }

    static func syncedUpdatedAt(pageId: String) -> String? {
        syncMeta[pageId]?["u"] as? String
    }

    static func isDirty(pageId: String) -> Bool {
        syncMeta[pageId]?["d"] as? Bool ?? false
    }

    static func markDirty(pageId: String) {
        var meta = syncMeta
        var entry = meta[pageId] ?? [:]
        entry["d"] = true
        meta[pageId] = entry
        syncMeta = meta
    }

    static func markSynced(pageId: String, updatedAt: String?) {
        var meta = syncMeta
        meta[pageId] = ["u": updatedAt ?? "", "d": false]
        syncMeta = meta
    }

    /// 페이지 삭제 시 로컬 흔적 정리
    static func removePage(pageId: String) {
        try? FileManager.default.removeItem(at: drawingURL(pageId: pageId))
        var meta = syncMeta
        meta[pageId] = nil
        syncMeta = meta
    }

    // MARK: Storage 파일 캐시

    private static func fileURL(path: String, version: String) -> URL {
        // 경로·버전을 파일 이름 하나로 만든다 (슬래시·콜론 등 제거)
        let raw = "\(path)@\(version)"
        let safe = raw.map { $0.isLetter || $0.isNumber || $0 == "." || $0 == "-" ? $0 : "_" }
        return filesDirectory.appendingPathComponent(String(safe))
    }

    static func storeFile(_ data: Data, path: String, version: String) {
        try? data.write(to: fileURL(path: path, version: version), options: .atomic)
    }

    /// 캐시에 있으면 그대로, 없으면 내려받아 캐시한다.
    /// - version: 같은 경로를 덮어쓰는 파일(미리보기)은 updated_at을 넘겨 새 파일을 받게 한다.
    static func data(path: String, version: String) async throws -> Data {
        let url = fileURL(path: path, version: version)
        if let cached = try? Data(contentsOf: url) {
            return cached
        }
        let data = try await SupabaseService.shared.downloadNotebookFile(path: path)
        try? data.write(to: url, options: .atomic)
        return data
    }
}
