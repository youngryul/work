import SwiftUI

/// 날짜/시간 없이 제목만 적는 예비 일정
struct TravelItinerarySpareListView: View {
    let tripId: String
    var onMoveToSchedule: (AbroadSpareItem) -> Void

    @State private var items: [AbroadSpareItem] = []
    @State private var draftTitle = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage = ""
    @State private var editingItem: AbroadSpareItem?
    @State private var editingTitle = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("예비 일정")
                    .font(.headline)
                Text("\(items.count)건")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.top, 12)
            .padding(.bottom, 4)

            Text("날짜·시간 없이 제목만 적어 두고, 나중에 일정으로 옮길 수 있어요.")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)
                .padding(.bottom, 8)

            HStack(spacing: 8) {
                TextField("예: 근교 당일치기...", text: $draftTitle)
                    .textFieldStyle(.roundedBorder)
                Button("추가") {
                    Task { await addItem() }
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
                .disabled(draftTitle.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            if isLoading {
                ProgressView("불러오는 중...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if items.isEmpty {
                Text("아직 예비 일정이 없습니다")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        spareRow(item, index: index + 1)
                    }
                }
                .listStyle(.plain)
            }
        }
        .alert("오류", isPresented: Binding(
            get: { !errorMessage.isEmpty },
            set: { _ in errorMessage = "" }
        )) {
            Button("확인") { errorMessage = "" }
        } message: {
            Text(errorMessage)
        }
        .task {
            await loadItems()
        }
    }

    @ViewBuilder
    private func spareRow(_ item: AbroadSpareItem, index: Int) -> some View {
        HStack(spacing: 10) {
            Text("\(index)")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.indigo)
                .frame(width: 18)

            if editingItem?.id == item.id {
                TextField("제목", text: $editingTitle)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        Task { await saveEdit() }
                    }
                Button("저장") {
                    Task { await saveEdit() }
                }
                .font(.caption)
            } else {
                Text(item.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editingItem = item
                        editingTitle = item.title
                    }
                Button("일정으로") {
                    onMoveToSchedule(item)
                }
                .font(.caption)
                .foregroundColor(.cyan)
                Button("삭제", role: .destructive) {
                    Task { await deleteItem(item) }
                }
                .font(.caption)
            }
        }
        .padding(.vertical, 2)
    }

    private func loadItems() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await SupabaseService.shared.fetchAbroadSpareItems(tripId: tripId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func addItem() async {
        let trimmed = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await SupabaseService.shared.createAbroadSpareItem(tripId: tripId, title: trimmed)
            items.append(created)
            draftTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveEdit() async {
        guard let editingItem else { return }
        let trimmed = editingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "예비 일정 제목을 입력해주세요."
            return
        }
        do {
            let updated = try await SupabaseService.shared.updateAbroadSpareItem(id: editingItem.id, title: trimmed)
            if let index = items.firstIndex(where: { $0.id == editingItem.id }) {
                items[index] = updated
            }
            self.editingItem = nil
            editingTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteItem(_ item: AbroadSpareItem) async {
        do {
            try await SupabaseService.shared.deleteAbroadSpareItem(id: item.id)
            items.removeAll { $0.id == item.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
