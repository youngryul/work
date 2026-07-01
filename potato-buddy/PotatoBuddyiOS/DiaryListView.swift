import SwiftUI

struct DiaryListView: View {
    @State private var diaries: [DiaryItem] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""
    @State private var selectedYear: Int
    @State private var selectedMonth: Int
    @State private var showWriteView: Bool = false
    @State private var selectedDiary: DiaryItem? = nil
    @State private var writeDate: String = ""

    init() {
        let now = Date()
        let calendar = Calendar.current
        _selectedYear  = State(initialValue: calendar.component(.year,  from: now))
        _selectedMonth = State(initialValue: calendar.component(.month, from: now))
    }

    private var monthTitle: String {
        "\(selectedYear)년 \(selectedMonth)월"
    }

    private var todayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 월 선택 헤더
                HStack {
                    Button {
                        changeMonth(by: -1)
                    } label: {
                        Image(systemName: "chevron.left")
                            .foregroundColor(.green)
                            .padding(8)
                    }

                    Spacer()

                    Text(monthTitle)
                        .font(.headline)

                    Spacer()

                    Button {
                        changeMonth(by: 1)
                    } label: {
                        Image(systemName: "chevron.right")
                            .foregroundColor(.green)
                            .padding(8)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(.systemBackground))

                Divider()

                if isLoading {
                    ProgressView("불러오는 중...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if diaries.isEmpty {
                    VStack(spacing: 16) {
                        Text("🥔")
                            .font(.system(size: 60))
                        Text("이달의 일기가 없어요")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Text("+ 버튼으로 오늘 일기를 써보세요")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(diaries) { diary in
                        Button {
                            selectedDiary = diary
                            writeDate = diary.date
                            showWriteView = true
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(formattedDate(diary.date))
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.primary)
                                Text(diary.content)
                                    .font(.body)
                                    .foregroundColor(.secondary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.insetGrouped)
                    .refreshable {
                        await loadDiaries()
                    }
                }
            }
            .navigationTitle("일기")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        selectedDiary = nil
                        writeDate = todayDateString
                        showWriteView = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .sheet(isPresented: $showWriteView, onDismiss: {
                Task { await loadDiaries() }
            }) {
                DiaryWriteView(date: writeDate, existingDiary: selectedDiary)
            }
            .alert("오류", isPresented: Binding(get: { !errorMessage.isEmpty }, set: { _ in errorMessage = "" })) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
        }
        .task {
            await loadDiaries()
        }
    }

    private func loadDiaries() async {
        isLoading = true
        errorMessage = ""
        do {
            diaries = try await SupabaseService.shared.fetchDiaries(year: selectedYear, month: selectedMonth)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func changeMonth(by value: Int) {
        var components = DateComponents()
        components.year  = selectedYear
        components.month = selectedMonth + value
        let calendar = Calendar(identifier: .gregorian)
        if let newDate = calendar.date(from: components) {
            selectedYear  = calendar.component(.year,  from: newDate)
            selectedMonth = calendar.component(.month, from: newDate)
            Task { await loadDiaries() }
        }
    }

    private func formattedDate(_ dateString: String) -> String {
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        let outputFormatter = DateFormatter()
        outputFormatter.dateFormat = "M월 d일 (E)"
        outputFormatter.locale = Locale(identifier: "ko_KR")
        if let date = inputFormatter.date(from: dateString) {
            return outputFormatter.string(from: date)
        }
        return dateString
    }
}
