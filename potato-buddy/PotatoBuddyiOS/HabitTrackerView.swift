import SwiftUI

struct HabitTrackerView: View {
    @State private var trackers: [HabitTrackerItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var selectedYear: Int
    @State private var selectedMonth: Int
    @State private var showAddForm = false
    @State private var trackerToDelete: HabitTrackerItem?
    @State private var trackerToEdit: HabitTrackerItem?
    @State private var editTitleDraft = ""

    private let calendar = Calendar(identifier: .gregorian)

    init() {
        let now = Date()
        _selectedYear = State(initialValue: Calendar.current.component(.year, from: now))
        _selectedMonth = State(initialValue: Calendar.current.component(.month, from: now))
    }

    private var monthTitle: String {
        "\(selectedYear)년 \(selectedMonth)월"
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                monthHeader
                Divider()

                Group {
                    if isLoading {
                        ProgressView("불러오는 중...")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if trackers.isEmpty {
                        emptyState
                    } else {
                        trackerList
                    }
                }
            }
            .navigationTitle("습관 트래커")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showAddForm = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.green)
                    }
                }
            }
            .sheet(isPresented: $showAddForm) {
                HabitTrackerFormView(
                    year: selectedYear,
                    month: selectedMonth,
                    onSave: {
                        showAddForm = false
                        await loadTrackers()
                    },
                    onCancel: {
                        showAddForm = false
                    }
                )
            }
            .confirmationDialog(
                "습관 트래커 삭제",
                isPresented: Binding(
                    get: { trackerToDelete != nil },
                    set: { if !$0 { trackerToDelete = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) {
                    if let tracker = trackerToDelete {
                        Task { await deleteTracker(tracker) }
                    }
                    trackerToDelete = nil
                }
                Button("취소", role: .cancel) {
                    trackerToDelete = nil
                }
            } message: {
                Text("'\(trackerToDelete?.title ?? "")' 트래커를 삭제할까요?")
            }
            .alert("제목 수정", isPresented: Binding(
                get: { trackerToEdit != nil },
                set: { if !$0 { trackerToEdit = nil } }
            )) {
                TextField("습관 제목", text: $editTitleDraft)
                Button("저장") {
                    if let tracker = trackerToEdit {
                        Task { await updateTitle(for: tracker) }
                    }
                }
                Button("취소", role: .cancel) {
                    trackerToEdit = nil
                }
            } message: {
                Text("습관 이름을 수정합니다.")
            }
            .alert("오류", isPresented: Binding(
                get: { !errorMessage.isEmpty },
                set: { _ in errorMessage = "" }
            )) {
                Button("확인") { errorMessage = "" }
            } message: {
                Text(errorMessage)
            }
        }
        .task {
            await loadTrackers()
        }
    }

    private var monthHeader: some View {
        HStack {
            Button { changeMonth(by: -1) } label: {
                Image(systemName: "chevron.left")
                    .foregroundColor(.green)
                    .padding(8)
            }

            Spacer()

            Text(monthTitle)
                .font(.headline)

            Spacer()

            Button { changeMonth(by: 1) } label: {
                Image(systemName: "chevron.right")
                    .foregroundColor(.green)
                    .padding(8)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Text("📌")
                .font(.system(size: 56))
            Text("등록된 습관 트래커가 없어요")
                .font(.title3)
                .foregroundColor(.secondary)
            Text("+ 버튼으로 습관을 추가해보세요")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var trackerList: some View {
        List {
            ForEach(trackers) { tracker in
                HabitTrackerCardView(
                    tracker: tracker,
                    year: selectedYear,
                    month: selectedMonth,
                    onToggleDay: { day, isCompleted in
                        await toggleDay(trackerId: tracker.id, day: day, isCompleted: isCompleted)
                    },
                    onEditTitle: {
                        trackerToEdit = tracker
                        editTitleDraft = tracker.title
                    }
                )
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        trackerToDelete = tracker
                    } label: {
                        Label("삭제", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable {
            await loadTrackers()
        }
    }

    private func loadTrackers() async {
        isLoading = true
        errorMessage = ""
        do {
            trackers = try await SupabaseService.shared.fetchHabitTrackers(
                year: selectedYear,
                month: selectedMonth
            )
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func toggleDay(trackerId: String, day: Int, isCompleted: Bool) async {
        do {
            let updatedDay = try await SupabaseService.shared.toggleHabitTrackerDay(
                trackerId: trackerId,
                day: day,
                isCompleted: isCompleted
            )

            guard let trackerIndex = trackers.firstIndex(where: { $0.id == trackerId }) else { return }

            if let dayIndex = trackers[trackerIndex].days.firstIndex(where: { $0.day == day }) {
                trackers[trackerIndex].days[dayIndex] = updatedDay
            } else {
                trackers[trackerIndex].days.append(updatedDay)
                trackers[trackerIndex].days.sort { $0.day < $1.day }
            }
        } catch {
            errorMessage = error.localizedDescription
            await loadTrackers()
        }
    }

    private func deleteTracker(_ tracker: HabitTrackerItem) async {
        do {
            try await SupabaseService.shared.deleteHabitTracker(id: tracker.id)
            trackers.removeAll { $0.id == tracker.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateTitle(for tracker: HabitTrackerItem) async {
        let trimmed = editTitleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        do {
            try await SupabaseService.shared.updateHabitTrackerTitle(id: tracker.id, title: trimmed)
            if let index = trackers.firstIndex(where: { $0.id == tracker.id }) {
                let current = trackers[index]
                trackers[index] = HabitTrackerItem(
                    id: current.id,
                    year: current.year,
                    month: current.month,
                    title: trimmed,
                    color: current.color,
                    days: current.days
                )
            }
            trackerToEdit = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func changeMonth(by value: Int) {
        var components = DateComponents()
        components.year = selectedYear
        components.month = selectedMonth + value
        guard let newDate = calendar.date(from: components) else { return }

        selectedYear = calendar.component(.year, from: newDate)
        selectedMonth = calendar.component(.month, from: newDate)
        Task { await loadTrackers() }
    }
}
