import SwiftUI

/// 웹 ReadingView와 대응 — 책 목록, 검색 등록, 기록 CRUD, 월 통계, 완독
struct ReadingView: View {
    @State private var books: [BookItem] = []
    /// 상세 화면 네비게이션은 id 로만 추적 — BookItem 값(완독 여부 등)이 바뀌어도 상세 화면이 재생성되지 않도록
    @State private var selectedBookId: String?
    @State private var records: [ReadingRecordItem] = []
    @State private var yearMonth = Date()
    @State private var stats = MonthlyReadingStats(totalBooks: 0, totalSessions: 0, totalMinutes: 0)
    @State private var isLoading = false
    @State private var errorMessage = ""

    @State private var showSearch = false
    /// 책 목록 구분 탭 (웹 기본값과 동일하게 '읽는 중')
    @State private var bookTab: BookStatus = .reading
    @State private var showCreateRecordForm = false  // 새 기록 작성용
    @State private var editingRecord: ReadingRecordItem?  // 기존 기록 수정용 (sheet(item:) 트리거)
    @State private var showInsightAlert = false
    @State private var insightText = ""
    @State private var bookToComplete: BookItem?
    @State private var bookToDelete: BookItem?
    @State private var showProgressAlert = false
    @State private var progressText = ""
    @State private var progressErrorMessage = ""

    /// 현재 선택된 책 (항상 최신 books 목록에서 조회)
    private var selectedBook: BookItem? {
        guard let selectedBookId else { return nil }
        return books.first { $0.id == selectedBookId }
    }

    private var year: Int { Calendar.current.component(.year, from: yearMonth) }
    private var month: Int { Calendar.current.component(.month, from: yearMonth) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 더보기 상단 커스텀 바(safeAreaInset)와 내비게이션 바 툴바가 겹쳐 + 버튼이 가려지므로
                // 툴바 대신 화면 상단에 책 추가 버튼을 둔다.
                HStack {
                    Spacer()
                    Button {
                        showSearch = true
                    } label: {
                        Label("책 추가", systemImage: "plus.circle.fill")
                            .font(.headline)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
                monthStatsBar
                Divider()
                if isLoading && books.isEmpty {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    bookList
                }
            }
            .navigationTitle("독서")
            .navigationBarTitleDisplayMode(.large)
            // 탭 '더보기' 시스템 뒤로가기와 상세 뒤로가기 중복 방지
            .navigationBarBackButtonHidden(true)
            .navigationDestination(item: $selectedBookId) { bookId in
                if let book = books.first(where: { $0.id == bookId }) {
                    bookDetail(book)
                } else {
                    ProgressView()
                }
            }
            .task { await reloadAll() }
            .refreshable { await reloadAll() }
            .sheet(isPresented: $showSearch) {
                BookSearchSheet { result in
                    try await registerBook(result)
                }
            }
            // 새 기록 작성 시트
            .sheet(isPresented: $showCreateRecordForm) {
                if let selectedBook {
                    ReadingRecordFormSheet(
                        bookTitle: selectedBook.title,
                        editing: nil
                    ) { date, pages, notes in
                        Task {
                            await saveRecord(
                                bookId: selectedBook.id,
                                date: date,
                                pages: pages,
                                notes: notes,
                                editingId: nil
                            )
                        }
                    }
                }
            }
            // 기존 기록 수정 시트 — sheet(item:) 으로 editingRecord 를 직접 전달해 SwiftUI 캡처 버그 방지
            .sheet(item: $editingRecord) { record in
                if let selectedBook {
                    ReadingRecordFormSheet(
                        bookTitle: selectedBook.title,
                        editing: record
                    ) { date, pages, notes in
                        Task {
                            await saveRecord(
                                bookId: selectedBook.id,
                                date: date,
                                pages: pages,
                                notes: notes,
                                editingId: record.id
                            )
                        }
                    }
                }
            }
            .confirmationDialog(
                "책을 삭제할까요?",
                isPresented: Binding(
                    get: { bookToDelete != nil && selectedBookId == nil },
                    set: { if !$0 { bookToDelete = nil } }
                ),
                titleVisibility: .visible,
                presenting: bookToDelete
            ) { book in
                Button("삭제", role: .destructive) {
                    Task { await deleteBook(book) }
                }
                Button("취소", role: .cancel) {}
            } message: { book in
                Text("'\(book.title)'의 독서 기록도 모두 삭제됩니다.")
            }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { if !$0 { errorMessage = "" } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    // MARK: - 월 통계

    private var monthStatsBar: some View {
        HStack {
            Button {
                shiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left")
            }
            Spacer()
            VStack(spacing: 4) {
                Text(verbatim: "\(year)년 \(month)월")
                    .font(.headline)
                Text("\(stats.totalBooks)권 · \(stats.totalSessions)회")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                shiftMonth(1)
            } label: {
                Image(systemName: "chevron.right")
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }

    // MARK: - 책 목록

    private var bookList: some View {
        Group {
            if books.isEmpty {
                ContentUnavailableView(
                    "등록된 책이 없습니다",
                    systemImage: "books.vertical",
                    description: Text("책 추가 버튼으로 책을 검색해 추가하세요.")
                )
            } else {
                VStack(spacing: 0) {
                    Picker("책 상태", selection: $bookTab) {
                        ForEach(BookStatus.allCases) { status in
                            Text(verbatim: "\(status.label) \(booksWithStatus(status).count)").tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.vertical, 8)

                    let visibleBooks = booksWithStatus(bookTab)
                    if visibleBooks.isEmpty {
                        ContentUnavailableView(
                            bookTab.emptyMessage,
                            systemImage: "books.vertical"
                        )
                    } else {
                        List(visibleBooks) { book in
                            Button {
                                Task { await selectBook(book) }
                            } label: {
                                bookRow(book)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                // 완료 전 책만 읽는 중 ↔ 읽기 전 전환 (웹 '읽기 시작/중단' 버튼과 동일)
                                if !book.completed {
                                    Button {
                                        Task { await toggleReading(book) }
                                    } label: {
                                        if book.isReading == true {
                                            Label("읽기 중단", systemImage: "pause.circle")
                                        } else {
                                            Label("읽기 시작", systemImage: "book")
                                        }
                                    }
                                    .tint(book.isReading == true ? .gray : .blue)
                                }
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    bookToDelete = book
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
        }
    }

    /// 상태별 책 목록 — 완료 책은 완료일 최신순 (웹과 동일)
    private func booksWithStatus(_ status: BookStatus) -> [BookItem] {
        let filtered = books.filter { $0.status == status }
        guard status == .completed else { return filtered }
        return filtered.sorted { ($0.completedAt ?? "") > ($1.completedAt ?? "") }
    }

    private func bookRow(_ book: BookItem) -> some View {
        HStack(spacing: 12) {
            bookThumbnail(url: book.thumbnailUrl, size: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(book.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    statusBadge(book.status)
                }
                Text(book.authorLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !book.completed && book.readPage > 0 {
                    progressView(book, font: .caption2)
                } else if !book.pageCountLabel.isEmpty {
                    Text(book.pageCountLabel)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    // MARK: - 책 상세

    private func bookDetail(_ book: BookItem) -> some View {
        List {
            Section {
                HStack(alignment: .top, spacing: 14) {
                    bookThumbnail(url: book.thumbnailUrl, size: 72)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(book.title).font(.title3.weight(.bold))
                            statusBadge(book.status)
                        }
                        Text(book.authorLabel).foregroundStyle(.secondary)
                        if let insight = book.oneLineInsight, !insight.isEmpty {
                            Text("“\(insight)”")
                                .font(.callout)
                                .foregroundStyle(.green)
                        }
                        HStack(spacing: 8) {
                            if !book.completed {
                                Button {
                                    Task { await toggleReading(book) }
                                } label: {
                                    Text(book.isReading == true ? "읽기 중단" : "읽기 시작")
                                        .font(.subheadline.weight(.semibold))
                                }
                                .buttonStyle(.bordered)
                                .tint(book.isReading == true ? .gray : .blue)
                            }
                            Button {
                                if book.completed {
                                    Task { await uncomplete(book) }
                                } else {
                                    bookToComplete = book
                                    insightText = book.oneLineInsight ?? ""
                                    showInsightAlert = true
                                }
                            } label: {
                                Text(book.completed ? "완독 해제" : "완독 처리")
                                    .font(.subheadline.weight(.semibold))
                            }
                            .buttonStyle(.bordered)
                            .tint(book.completed ? .orange : .green)
                        }
                    }
                }
            }

            // 완독 전 책만 읽은 위치 표시 (웹 BookProgress 와 동일)
            if !book.completed {
                Section {
                    HStack(alignment: .center, spacing: 12) {
                        progressView(book, font: .subheadline)
                        Button(book.readPage > 0 ? "위치 수정" : "위치 기록") {
                            progressText = book.readPage > 0 ? String(book.readPage) : ""
                            showProgressAlert = true
                        }
                        .buttonStyle(.bordered)
                        .font(.caption.weight(.semibold))
                    }
                } header: {
                    Text("읽은 위치")
                }
            }

            Section {
                ForEach(records) { record in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(record.readingDate)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(record.pagesLabel)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let notes = record.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.body)
                                .foregroundStyle(.primary)
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editingRecord = record
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task { await deleteRecord(record.id) }
                        } label: {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                }
                // 추가 버튼은 기록 목록 하단 하나만 둔다
                Button {
                    showCreateRecordForm = true
                } label: {
                    Label("기록 추가", systemImage: "plus.circle")
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                }
            } header: {
                Text("독서 기록")
            }

            // 더보기 상단 커스텀 바와 겹쳐 툴바가 가려지므로 삭제도 본문에 둔다
            Section {
                Button(role: .destructive) {
                    bookToDelete = book
                } label: {
                    Label("책 삭제", systemImage: "trash")
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(book.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadRecords(for: book.id)
        }
        // 알럿은 push 된 상세 화면에 붙여야 정상적으로 표시됨 (루트에 붙이면 상세 화면에서 뜨지 않음)
        .alert("한줄 인사이트", isPresented: $showInsightAlert) {
            TextField("이 책을 한 문장으로", text: $insightText)
            Button("완독 처리") {
                Task { await completeWithInsight() }
            }
            Button("취소", role: .cancel) {
                bookToComplete = nil
                insightText = ""
            }
        } message: {
            Text("완독 시 남길 한줄 메모를 적어주세요. (선택)")
        }
        .alert("읽은 위치", isPresented: $showProgressAlert) {
            TextField("페이지", text: $progressText)
                .keyboardType(.numberPad)
            Button("저장") {
                Task { await saveProgress(book) }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text((book.pageCount ?? 0) > 0
                 ? "몇 쪽까지 읽었나요? (전체 \(book.pageCount ?? 0)쪽)"
                 : "몇 쪽까지 읽었나요?")
        }
        .alert("저장 실패", isPresented: Binding(
            get: { !progressErrorMessage.isEmpty },
            set: { if !$0 { progressErrorMessage = "" } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(progressErrorMessage)
        }
        .confirmationDialog(
            "책을 삭제할까요?",
            isPresented: Binding(
                get: { bookToDelete != nil && selectedBookId != nil },
                set: { if !$0 { bookToDelete = nil } }
            ),
            titleVisibility: .visible,
            presenting: bookToDelete
        ) { target in
            Button("삭제", role: .destructive) {
                Task { await deleteBook(target) }
            }
            Button("취소", role: .cancel) {}
        } message: { target in
            Text("'\(target.title)'의 독서 기록도 모두 삭제됩니다.")
        }
    }

    // MARK: - Helpers

    /// 상태 배지 (읽는 중 / 읽기 전 / 완독)
    private func statusBadge(_ status: BookStatus) -> some View {
        let color: Color
        let text: String
        switch status {
        case .reading:
            color = .blue
            text = "읽는 중"
        case .idle:
            color = .gray
            text = "읽기 전"
        case .completed:
            color = .green
            text = "완독"
        }
        return Text(text)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
            .fixedSize()
    }

    /// 읽은 페이지 문구 + 진행 막대
    private func progressView(_ book: BookItem, font: Font) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("📖 \(book.progressLabel)")
                .font(font)
                .foregroundStyle(book.readPage > 0 ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.tertiary)
            if book.readPage > 0, let percent = book.progressPercent {
                ProgressView(value: Double(percent), total: 100)
                    .tint(.blue)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func bookThumbnail(url: String?, size: CGFloat) -> some View {
        if let url, let imageURL = URL(string: Self.httpsURLString(url)) {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholderCover(size: size)
                }
            }
            .frame(width: size * 0.72, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        } else {
            placeholderCover(size: size)
        }
    }

    private static func httpsURLString(_ raw: String) -> String {
        if raw.hasPrefix("http://") {
            return "https://" + raw.dropFirst("http://".count)
        }
        return raw
    }

    private func placeholderCover(size: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color.green.opacity(0.12))
            .frame(width: size * 0.72, height: size)
            .overlay {
                Image(systemName: "book.closed.fill")
                    .foregroundStyle(.green.opacity(0.6))
            }
    }

    private func shiftMonth(_ delta: Int) {
        if let next = Calendar.current.date(byAdding: .month, value: delta, to: yearMonth) {
            yearMonth = next
            Task { await loadStats() }
        }
    }

    private func reloadAll() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let booksTask = SupabaseService.shared.fetchBooks()
            async let statsTask = SupabaseService.shared.fetchMonthlyReadingStats(year: year, month: month)
            books = try await booksTask
            stats = try await statsTask
            if let selectedBookId {
                if books.contains(where: { $0.id == selectedBookId }) {
                    records = try await SupabaseService.shared.fetchReadingRecords(bookId: selectedBookId)
                } else {
                    // 다른 기기에서 삭제된 경우 상세 화면 닫기
                    self.selectedBookId = nil
                    records = []
                }
            }
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func loadStats() async {
        do {
            stats = try await SupabaseService.shared.fetchMonthlyReadingStats(year: year, month: month)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func selectBook(_ book: BookItem) async {
        records = []
        selectedBookId = book.id
        await loadRecords(for: book.id)
    }

    private func loadRecords(for bookId: String) async {
        do {
            records = try await SupabaseService.shared.fetchReadingRecords(bookId: bookId)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    /// 등록 실패 시 에러를 던져 검색 시트에서 알림을 띄움 (루트 알럿은 시트에 가려 보이지 않음)
    private func registerBook(_ result: BookSearchResult) async throws {
        let book = try await SupabaseService.shared.createBook(
            title: result.title,
            author: result.author,
            publisher: result.publisher,
            isbn: result.isbn,
            thumbnailUrl: result.thumbnailUrl,
            description: result.description,
            pageCount: result.pageCount,
            publishedDate: result.publishedDate,
            apiSource: result.apiSource,
            apiId: result.apiId
        )
        showSearch = false
        // 상세에서 돌아왔을 때 새 책이 보이도록 해당 상태 탭으로 이동
        bookTab = book.status
        await reloadAll()
        await selectBook(book)
    }

    private func saveRecord(bookId: String, date: String, pages: Int?, notes: String?, editingId: String?) async {
        do {
            if let editingId {
                _ = try await SupabaseService.shared.updateReadingRecord(
                    id: editingId,
                    readingDate: date,
                    pagesRead: pages,
                    notes: notes
                )
            } else {
                _ = try await SupabaseService.shared.createReadingRecord(
                    bookId: bookId,
                    readingDate: date,
                    pagesRead: pages,
                    notes: notes
                )
            }
            showCreateRecordForm = false
            editingRecord = nil  // sheet(item:) 시트 자동 닫힘
            records = try await SupabaseService.shared.fetchReadingRecords(bookId: bookId)
            await loadStats()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func deleteRecord(_ id: String) async {
        guard let selectedBook else { return }
        do {
            try await SupabaseService.shared.deleteReadingRecord(id: id)
            records = try await SupabaseService.shared.fetchReadingRecords(bookId: selectedBook.id)
            await loadStats()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    /// 읽는 중 ↔ 읽기 전 전환
    private func toggleReading(_ book: BookItem) async {
        do {
            let updated = try await SupabaseService.shared.updateBookReading(
                bookId: book.id,
                isReading: book.isReading != true
            )
            replaceBook(updated)
        } catch {
            guard !error.isCancellation else { return }
            // 상세 화면에서는 루트 알럿이 뜨지 않으므로 상세 화면 알럿 사용
            if selectedBookId != nil {
                progressErrorMessage = "상태 변경에 실패했습니다."
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    /// 읽은 위치 저장 — 웹과 동일하게 빈 값은 0, 음수·전체 페이지 초과는 거부
    private func saveProgress(_ book: BookItem) async {
        let trimmed = progressText.trimmingCharacters(in: .whitespacesAndNewlines)
        let page: Int
        if trimmed.isEmpty {
            page = 0
        } else if let parsed = Int(trimmed), parsed >= 0 {
            page = parsed
        } else {
            progressErrorMessage = "페이지는 0 이상의 숫자로 입력해주세요."
            return
        }
        if let pageCount = book.pageCount, pageCount > 0, page > pageCount {
            progressErrorMessage = "전체 \(pageCount)페이지를 넘을 수 없습니다."
            return
        }
        do {
            let updated = try await SupabaseService.shared.updateBookProgress(bookId: book.id, currentPage: page)
            progressText = ""
            replaceBook(updated)
        } catch {
            if !error.isCancellation { progressErrorMessage = "읽은 위치 저장에 실패했습니다." }
        }
    }

    private func completeWithInsight() async {
        guard let book = bookToComplete else { return }
        do {
            let updated = try await SupabaseService.shared.updateBookCompletion(
                bookId: book.id,
                isCompleted: true,
                oneLineInsight: insightText
            )
            bookToComplete = nil
            insightText = ""
            replaceBook(updated)
            await reloadAll()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    private func uncomplete(_ book: BookItem) async {
        do {
            let updated = try await SupabaseService.shared.updateBookCompletion(
                bookId: book.id,
                isCompleted: false,
                oneLineInsight: nil
            )
            replaceBook(updated)
            await reloadAll()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    /// 서버 응답으로 받은 책을 목록에 즉시 반영
    private func replaceBook(_ updated: BookItem) {
        if let index = books.firstIndex(where: { $0.id == updated.id }) {
            books[index] = updated
        }
    }

    private func deleteBook(_ book: BookItem) async {
        bookToDelete = nil
        do {
            try await SupabaseService.shared.deleteBook(bookId: book.id)
            if selectedBookId == book.id {
                selectedBookId = nil
                records = []
            }
            books.removeAll { $0.id == book.id }
            await reloadAll()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}

// MARK: - 책 검색 시트

private struct BookSearchSheet: View {
    /// 등록 처리 — 성공 시 부모가 시트를 닫고, 실패 시 에러를 던짐
    let onSelect: (BookSearchResult) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [BookSearchResult] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var searchedQuery = ""
    @State private var errorMessage = ""
    /// 등록 요청 중 중복 탭 방지
    @State private var isRegistering = false
    @State private var registerErrorMessage = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("책 제목 검색", text: $query)
                            .textInputAutocapitalization(.never)
                            .disableAutocorrection(true)
                            .onSubmit { Task { await search() } }
                        Button("검색") { Task { await search() } }
                            .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isSearching)
                    }
                }

                if isSearching {
                    ProgressView("검색 중...")
                } else if !errorMessage.isEmpty {
                    Text(errorMessage).foregroundStyle(.red)
                } else if results.isEmpty && hasSearched {
                    // 알라딘 결과가 없으면 Open Library 로 대체되는데, Open Library 는 3글자 이상만 검색 가능 (웹과 동일 안내)
                    Text(searchedQuery.count < 3
                         ? "검색 결과가 없습니다. 검색어는 3글자 이상 입력해 주세요."
                         : "검색 결과가 없습니다.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(results) { item in
                        Button {
                            Task { await register(item) }
                        } label: {
                            HStack(spacing: 12) {
                                if let url = URL(string: item.thumbnailUrl.hasPrefix("http://")
                                    ? "https://" + item.thumbnailUrl.dropFirst(7)
                                    : item.thumbnailUrl), !item.thumbnailUrl.isEmpty {
                                    AsyncImage(url: url) { image in
                                        image.resizable().scaledToFill()
                                    } placeholder: {
                                        Color.gray.opacity(0.15)
                                    }
                                    .frame(width: 40, height: 56)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title).font(.body.weight(.semibold)).foregroundStyle(.primary)
                                    Text(item.author.isEmpty ? "저자 미상" : item.author)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    if !item.publisher.isEmpty {
                                        Text(item.publisher)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    if item.pageCount > 0 {
                                        Text("\(item.pageCount)쪽")
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "plus.circle.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                        .disabled(isRegistering)
                    }
                }
            }
            .navigationTitle("책 검색")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
            .overlay {
                if isRegistering {
                    ProgressView("등록 중...")
                        .padding()
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .alert("책 등록 실패", isPresented: Binding(
                get: { !registerErrorMessage.isEmpty },
                set: { if !$0 { registerErrorMessage = "" } }
            )) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(registerErrorMessage)
            }
        }
    }

    private func register(_ item: BookSearchResult) async {
        guard !isRegistering else { return }
        isRegistering = true
        defer { isRegistering = false }
        do {
            try await onSelect(item)
        } catch {
            if !error.isCancellation { registerErrorMessage = error.localizedDescription }
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        isSearching = true
        errorMessage = ""
        defer {
            isSearching = false
            hasSearched = true
            searchedQuery = q
        }
        do {
            results = try await SupabaseService.shared.searchBooks(query: q)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
            results = []
        }
    }
}

// MARK: - 기록 폼

private struct ReadingRecordFormSheet: View {
    let bookTitle: String
    let editing: ReadingRecordItem?
    let onSave: (_ date: String, _ pages: Int?, _ notes: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var pagesText = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section(bookTitle) {
                    DatePicker("날짜", selection: $date, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "ko_KR"))
                    TextField("읽은 페이지", text: $pagesText)
                        .keyboardType(.numberPad)
                    TextField("메모", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle(editing == nil ? "기록 추가" : "기록 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        let formatter = DateFormatter()
                        formatter.calendar = Calendar(identifier: .gregorian)
                        formatter.locale = Locale(identifier: "en_US_POSIX")
                        formatter.dateFormat = "yyyy-MM-dd"
                        let pages = Int(pagesText.trimmingCharacters(in: .whitespaces))
                        onSave(formatter.string(from: date), pages, notes)
                    }
                }
            }
            .onAppear {
                if let editing {
                    let formatter = DateFormatter()
                    formatter.calendar = Calendar(identifier: .gregorian)
                    formatter.locale = Locale(identifier: "en_US_POSIX")
                    formatter.dateFormat = "yyyy-MM-dd"
                    if let parsed = formatter.date(from: editing.readingDate) {
                        date = parsed
                    }
                    if let pages = editing.pagesRead {
                        pagesText = String(pages)
                    }
                    notes = editing.notes ?? ""
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
