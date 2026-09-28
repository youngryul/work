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
    @State private var showCreateRecordForm = false  // 새 기록 작성용
    @State private var editingRecord: ReadingRecordItem?  // 기존 기록 수정용 (sheet(item:) 트리거)
    @State private var showInsightAlert = false
    @State private var insightText = ""
    @State private var bookToComplete: BookItem?
    @State private var bookToDelete: BookItem?

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
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showSearch = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
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
                    Task { await registerBook(result) }
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
                    description: Text("오른쪽 위 + 버튼으로 책을 검색해 추가하세요.")
                )
            } else {
                List(books) { book in
                    Button {
                        Task { await selectBook(book) }
                    } label: {
                        bookRow(book)
                    }
                    .buttonStyle(.plain)
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

    private func bookRow(_ book: BookItem) -> some View {
        HStack(spacing: 12) {
            bookThumbnail(url: book.thumbnailUrl, size: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(book.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    if book.completed {
                        Text("완독")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .foregroundStyle(.green)
                            .clipShape(Capsule())
                    }
                }
                Text(book.authorLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !book.pageCountLabel.isEmpty {
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
                        Text(book.title).font(.title3.weight(.bold))
                        Text(book.authorLabel).foregroundStyle(.secondary)
                        if let insight = book.oneLineInsight, !insight.isEmpty {
                            Text("“\(insight)”")
                                .font(.callout)
                                .foregroundStyle(.green)
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

            Section {
                if records.isEmpty {
                    Button {
                        showCreateRecordForm = true
                    } label: {
                        Label("기록 추가", systemImage: "plus.circle")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 4)
                    }
                } else {
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
                    // 기록이 있어도 하단에 추가 버튼 노출
                    Button {
                        showCreateRecordForm = true
                    } label: {
                        Label("기록 추가", systemImage: "plus.circle")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 4)
                    }
                }
            } header: {
                Text("독서 기록")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(book.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCreateRecordForm = true
                } label: {
                    Image(systemName: "plus.circle")
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button(role: .destructive) {
                    bookToDelete = book
                } label: {
                    Label("책 삭제", systemImage: "trash")
                }
            }
        }
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

    private func registerBook(_ result: BookSearchResult) async {
        do {
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
            await reloadAll()
            await selectBook(book)
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
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
    let onSelect: (BookSearchResult) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [BookSearchResult] = []
    @State private var isSearching = false
    @State private var errorMessage = ""

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
                } else if results.isEmpty && !query.isEmpty {
                    Text("검색 결과가 없습니다.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(results) { item in
                        Button {
                            onSelect(item)
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
                                }
                            }
                        }
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
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        isSearching = true
        errorMessage = ""
        defer { isSearching = false }
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
