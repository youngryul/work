import SwiftUI

/// 웹 ReadingView와 대응 — 책 목록, 검색 등록, 기록 CRUD, 월 통계, 완독
struct ReadingView: View {
    @State private var books: [BookItem] = []
    @State private var selectedBook: BookItem?
    @State private var records: [ReadingRecordItem] = []
    @State private var yearMonth = Date()
    @State private var stats = MonthlyReadingStats(totalBooks: 0, totalSessions: 0, totalMinutes: 0)
    @State private var isLoading = false
    @State private var errorMessage = ""

    @State private var showSearch = false
    @State private var showRecordForm = false
    @State private var editingRecord: ReadingRecordItem?
    @State private var showInsightAlert = false
    @State private var insightText = ""
    @State private var bookToComplete: BookItem?

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
                } else if let selectedBook {
                    bookDetail(selectedBook)
                } else {
                    bookList
                }
            }
            .navigationTitle("독서")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showSearch = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task { await reloadAll() }
            .refreshable { await reloadAll() }
            .sheet(isPresented: $showSearch) {
                BookSearchSheet { result in
                    Task { await registerBook(result) }
                }
            }
            .sheet(isPresented: $showRecordForm) {
                if let selectedBook {
                    ReadingRecordFormSheet(
                        bookTitle: selectedBook.title,
                        editing: editingRecord
                    ) { date, pages, notes in
                        Task {
                            await saveRecord(
                                bookId: selectedBook.id,
                                date: date,
                                pages: pages,
                                notes: notes
                            )
                        }
                    }
                }
            }
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
                Text("\(year)년 \(month)월")
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
        VStack(spacing: 0) {
            HStack {
                Button {
                    selectedBook = nil
                    records = []
                } label: {
                    Label("목록", systemImage: "chevron.left")
                }
                Spacer()
                Button {
                    editingRecord = nil
                    showRecordForm = true
                } label: {
                    Label("기록 추가", systemImage: "plus.circle")
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)

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

                Section("독서 기록") {
                    if records.isEmpty {
                        Text("기록이 없습니다.")
                            .foregroundStyle(.secondary)
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
                                showRecordForm = true
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    Task { await deleteRecord(record.id) }
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
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
            if let selected = selectedBook,
               let refreshed = books.first(where: { $0.id == selected.id }) {
                selectedBook = refreshed
                records = try await SupabaseService.shared.fetchReadingRecords(bookId: refreshed.id)
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
        selectedBook = book
        do {
            records = try await SupabaseService.shared.fetchReadingRecords(bookId: book.id)
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

    private func saveRecord(bookId: String, date: String, pages: Int?, notes: String?) async {
        do {
            if let editingRecord {
                _ = try await SupabaseService.shared.updateReadingRecord(
                    id: editingRecord.id,
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
            showRecordForm = false
            self.editingRecord = nil
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
            await reloadAll()
            selectedBook = updated
            records = try await SupabaseService.shared.fetchReadingRecords(bookId: updated.id)
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
            await reloadAll()
            selectedBook = updated
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
