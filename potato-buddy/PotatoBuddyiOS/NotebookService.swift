import Foundation
import SwiftUI

// MARK: - 모델 (notebooks / notebook_pages 테이블)

/// 속지 종류 (`paper_type`). pdf는 PDF를 가져온 페이지에만 쓴다.
enum NotebookPaperType: String, CaseIterable, Identifiable {
    case blank
    case lined
    case grid
    case dot
    case pdf

    var id: String { rawValue }

    var label: String {
        switch self {
        case .blank: return "무지"
        case .lined: return "줄노트"
        case .grid: return "모눈"
        case .dot: return "도트"
        case .pdf: return "PDF"
        }
    }

    /// 사용자가 고를 수 있는 속지 (pdf 제외)
    static let selectable: [NotebookPaperType] = [.blank, .lined, .grid, .dot]
}

/// 노트 표지 색 (`cover_color`)
enum NotebookCoverColor: String, CaseIterable, Identifiable {
    case green
    case sky
    case peach
    case lavender
    case butter
    case charcoal

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .green: return Color(red: 0.55, green: 0.75, blue: 0.52)
        case .sky: return Color(red: 0.53, green: 0.72, blue: 0.88)
        case .peach: return Color(red: 0.96, green: 0.68, blue: 0.58)
        case .lavender: return Color(red: 0.72, green: 0.64, blue: 0.88)
        case .butter: return Color(red: 0.97, green: 0.85, blue: 0.48)
        case .charcoal: return Color(red: 0.33, green: 0.34, blue: 0.38)
        }
    }

    static func from(_ raw: String) -> NotebookCoverColor {
        NotebookCoverColor(rawValue: raw) ?? .green
    }
}

/// 페이지에 붙인 사진 (`notebook_pages.images`의 한 원소, 좌표는 페이지 기준 pt)
struct NotebookPageImage: Codable, Identifiable, Hashable {
    var id: String
    var path: String
    var x: Double
    var y: Double
    var width: Double
    var height: Double

    var frame: CGRect {
        get { CGRect(x: x, y: y, width: width, height: height) }
        set {
            x = newValue.origin.x
            y = newValue.origin.y
            width = newValue.width
            height = newValue.height
        }
    }
}

/// 노트 목록 표지용 페이지 요약 (notebooks 조회 시 함께 가져옴)
struct NotebookPageSummary: Codable, Hashable {
    let previewPath: String?
    let pageOrder: Double
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case previewPath = "preview_path"
        case pageOrder = "page_order"
        case updatedAt = "updated_at"
    }
}

struct Notebook: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var coverColor: String
    var paperType: String
    var pdfPath: String?
    var updatedAt: String?
    var pages: [NotebookPageSummary]

    enum CodingKeys: String, CodingKey {
        case id, title
        case coverColor = "cover_color"
        case paperType = "paper_type"
        case pdfPath = "pdf_path"
        case updatedAt = "updated_at"
        case pages = "notebook_pages"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        coverColor = try c.decodeIfPresent(String.self, forKey: .coverColor) ?? NotebookCoverColor.green.rawValue
        paperType = try c.decodeIfPresent(String.self, forKey: .paperType) ?? NotebookPaperType.lined.rawValue
        pdfPath = try c.decodeIfPresent(String.self, forKey: .pdfPath)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        pages = try c.decodeIfPresent([NotebookPageSummary].self, forKey: .pages) ?? []
    }

    var displayTitle: String { title.isEmpty ? "제목 없는 노트" : title }
    var cover: NotebookCoverColor { .from(coverColor) }
    var defaultPaper: NotebookPaperType { NotebookPaperType(rawValue: paperType) ?? .lined }

    /// 첫 페이지 요약 (표지 미리보기)
    var firstPage: NotebookPageSummary? {
        pages.min { $0.pageOrder < $1.pageOrder }
    }
}

struct NotebookPage: Codable, Identifiable, Hashable {
    let id: String
    let notebookId: String
    var pageOrder: Double
    var paperType: String
    var pdfPageIndex: Int?
    var drawingPath: String?
    var previewPath: String?
    var images: [NotebookPageImage]
    var recognizedText: String
    var updatedAt: String?
    /// 검색 결과에서만 채워지는 노트 제목
    var notebookTitle: String?

    enum CodingKeys: String, CodingKey {
        case id, images
        case notebookId = "notebook_id"
        case pageOrder = "page_order"
        case paperType = "paper_type"
        case pdfPageIndex = "pdf_page_index"
        case drawingPath = "drawing_path"
        case previewPath = "preview_path"
        case recognizedText = "recognized_text"
        case updatedAt = "updated_at"
        case notebook = "notebooks"
    }

    private struct NotebookTitleRow: Codable {
        let title: String?
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        notebookId = try c.decode(String.self, forKey: .notebookId)
        pageOrder = try c.decodeIfPresent(Double.self, forKey: .pageOrder) ?? 0
        paperType = try c.decodeIfPresent(String.self, forKey: .paperType) ?? NotebookPaperType.lined.rawValue
        pdfPageIndex = try c.decodeIfPresent(Int.self, forKey: .pdfPageIndex)
        drawingPath = try c.decodeIfPresent(String.self, forKey: .drawingPath)
        previewPath = try c.decodeIfPresent(String.self, forKey: .previewPath)
        images = (try? c.decodeIfPresent([NotebookPageImage].self, forKey: .images)) ?? []
        recognizedText = try c.decodeIfPresent(String.self, forKey: .recognizedText) ?? ""
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        notebookTitle = (try? c.decodeIfPresent(NotebookTitleRow.self, forKey: .notebook))?.title
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(notebookId, forKey: .notebookId)
        try c.encode(pageOrder, forKey: .pageOrder)
        try c.encode(paperType, forKey: .paperType)
        try c.encodeIfPresent(pdfPageIndex, forKey: .pdfPageIndex)
        try c.encodeIfPresent(drawingPath, forKey: .drawingPath)
        try c.encodeIfPresent(previewPath, forKey: .previewPath)
        try c.encode(images, forKey: .images)
        try c.encode(recognizedText, forKey: .recognizedText)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }

    var paper: NotebookPaperType { NotebookPaperType(rawValue: paperType) ?? .lined }

    /// 이 페이지가 쓰는 Storage 파일 경로 (삭제용)
    var storagePaths: [String] {
        [drawingPath, previewPath].compactMap { $0 } + images.map(\.path)
    }
}

/// 새 페이지 생성 입력
struct NotebookNewPage {
    var pageOrder: Double
    var paperType: NotebookPaperType
    var pdfPageIndex: Int? = nil
}

// MARK: - Supabase 조회/저장

extension SupabaseService {
    /// 비공개 Storage 버킷 이름 (경로: `{userId}/{notebookId}/파일`)
    static let notebookBucket = "notebooks"

    private static let notebookListSelect = "*,notebook_pages(preview_path,page_order,updated_at)"

    func fetchNotebooks() async throws -> [Notebook] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/notebooks")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: Self.notebookListSelect),
            URLQueryItem(name: "order", value: "updated_at.desc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([Notebook].self, from: data)
    }

    func createNotebook(
        title: String,
        coverColor: NotebookCoverColor,
        paperType: NotebookPaperType
    ) async throws -> Notebook {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/notebooks")!
        components.queryItems = [URLQueryItem(name: "select", value: Self.notebookListSelect)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = [
            "user_id": userId,
            "title": title,
            "cover_color": coverColor.rawValue,
            "paper_type": paperType.rawValue,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        guard let item = try JSONDecoder().decode([Notebook].self, from: data).first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    /// 제목·표지·기본 속지·PDF 경로 수정 (nil인 값은 건드리지 않음)
    @discardableResult
    func updateNotebook(
        id: String,
        title: String? = nil,
        coverColor: NotebookCoverColor? = nil,
        paperType: NotebookPaperType? = nil,
        pdfPath: String? = nil
    ) async throws -> Notebook {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/notebooks")!
        components.queryItems = [
            URLQueryItem(name: "id", value: "eq.\(id)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: Self.notebookListSelect),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [:]
        if let title { body["title"] = title }
        if let coverColor { body["cover_color"] = coverColor.rawValue }
        if let paperType { body["paper_type"] = paperType.rawValue }
        if let pdfPath { body["pdf_path"] = pdfPath }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        guard let item = try JSONDecoder().decode([Notebook].self, from: data).first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    /// 노트 삭제 (페이지는 cascade, Storage 파일은 직접 지운다)
    func deleteNotebook(_ notebook: Notebook) async throws {
        let pages = try await fetchNotebookPages(notebookId: notebook.id)
        let paths = pages.flatMap(\.storagePaths) + [notebook.pdfPath].compactMap { $0 }
        try? await deleteNotebookFiles(paths)

        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/notebooks?id=eq.\(notebook.id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    func fetchNotebookPages(notebookId: String) async throws -> [NotebookPage] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/notebook_pages")!
        components.queryItems = [
            URLQueryItem(name: "notebook_id", value: "eq.\(notebookId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "page_order.asc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([NotebookPage].self, from: data)
    }

    /// 페이지 여러 장을 한 번에 생성
    func createNotebookPages(notebookId: String, pages: [NotebookNewPage]) async throws -> [NotebookPage] {
        guard !pages.isEmpty else { return [] }
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/notebook_pages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")
        let body: [[String: Any]] = pages.map { page in
            var row: [String: Any] = [
                "notebook_id": notebookId,
                "user_id": userId,
                "page_order": page.pageOrder,
                "paper_type": page.paperType.rawValue,
            ]
            // 일괄 insert는 모든 행의 키가 같아야 하므로 NSNull로 채운다
            row["pdf_page_index"] = page.pdfPageIndex.map { $0 as Any } ?? NSNull()
            return row
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder()
            .decode([NotebookPage].self, from: data)
            .sorted { $0.pageOrder < $1.pageOrder }
    }

    /// 페이지 필드 수정 (drawing_path, preview_path, images, recognized_text, paper_type 등)
    func updateNotebookPage(id: String, fields: [String: Any]) async throws -> NotebookPage {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/notebook_pages?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: fields)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        guard let item = try JSONDecoder().decode([NotebookPage].self, from: data).first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    func deleteNotebookPage(_ page: NotebookPage) async throws {
        try? await deleteNotebookFiles(page.storagePaths)

        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/notebook_pages?id=eq.\(page.id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    /// 손글씨 인식 결과로 페이지 검색 (노트 제목 포함)
    func searchNotebookPages(query: String) async throws -> [NotebookPage] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/notebook_pages")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "recognized_text", value: "ilike.*\(query)*"),
            URLQueryItem(name: "select", value: "*,notebooks(title)"),
            URLQueryItem(name: "order", value: "updated_at.desc"),
            URLQueryItem(name: "limit", value: "50"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([NotebookPage].self, from: data)
    }

    // MARK: Storage (비공개 notebooks 버킷)

    /// `{userId}/{notebookId}/{fileName}` 경로 생성
    func notebookStoragePath(notebookId: String, fileName: String) async -> String {
        let (userId, _) = await authInfo()
        return "\(userId)/\(notebookId)/\(fileName)"
    }

    /// 같은 경로가 있으면 덮어쓴다
    func uploadNotebookFile(_ data: Data, path: String, contentType: String) async throws {
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/storage/v1/object/\(Self.notebookBucket)/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue(contentType, forHTTPHeaderField: "Content-Type")
        request.addValue("true", forHTTPHeaderField: "x-upsert")
        request.httpBody = data
        let (respData, response) = try await fetch(request)
        try checkResponse(respData, response)
    }

    func downloadNotebookFile(path: String) async throws -> Data {
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/storage/v1/object/authenticated/\(Self.notebookBucket)/\(path)")!
        var request = URLRequest(url: url)
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return data
    }

    func deleteNotebookFiles(_ paths: [String]) async throws {
        guard !paths.isEmpty else { return }
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/storage/v1/object/\(Self.notebookBucket)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: ["prefixes": paths])
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }
}
