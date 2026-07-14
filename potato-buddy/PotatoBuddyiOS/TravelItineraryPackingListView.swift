import SwiftUI

/// 여행별 준비물 체크리스트
struct TravelItineraryPackingListView: View {
    let tripId: String

    @State private var items: [AbroadPackingItem] = []
    @State private var draftTitle = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage = ""
    @State private var editingItem: AbroadPackingItem?
    @State private var editingTitle = ""

    private var checkedCount: Int {
        items.filter(\.isChecked).count
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("준비물")
                    .font(.headline)
                Text("\(checkedCount)/\(items.count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.top, 12)
            .padding(.bottom, 8)

            HStack(spacing: 8) {
                TextField("예: 여권, 충전기...", text: $draftTitle)
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
                Text("아직 준비물이 없습니다")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(items) { item in
                        packingRow(item)
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
    private func packingRow(_ item: AbroadPackingItem) -> some View {
        HStack(spacing: 12) {
            Button {
                Task { await toggle(item) }
            } label: {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(item.isChecked ? .cyan : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)

            if editingItem?.id == item.id {
                TextField("준비물", text: $editingTitle)
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
                    .strikethrough(item.isChecked)
                    .foregroundColor(item.isChecked ? .secondary : .primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editingItem = item
                        editingTitle = item.title
                    }
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
            items = try await SupabaseService.shared.fetchAbroadPackingItems(tripId: tripId)
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
            let created = try await SupabaseService.shared.createAbroadPackingItem(tripId: tripId, title: trimmed)
            items.append(created)
            draftTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func toggle(_ item: AbroadPackingItem) async {
        let next = !item.isChecked
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = AbroadPackingItem(
                id: item.id,
                tripId: item.tripId,
                title: item.title,
                isChecked: next,
                sortOrder: item.sortOrder
            )
        }
        do {
            let updated = try await SupabaseService.shared.updateAbroadPackingItem(
                id: item.id,
                title: nil,
                isChecked: next
            )
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index] = updated
            }
        } catch {
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index] = item
            }
            errorMessage = error.localizedDescription
        }
    }

    private func saveEdit() async {
        guard let editingItem else { return }
        let trimmed = editingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "준비물 이름을 입력해주세요."
            return
        }
        do {
            let updated = try await SupabaseService.shared.updateAbroadPackingItem(
                id: editingItem.id,
                title: trimmed,
                isChecked: nil
            )
            if let index = items.firstIndex(where: { $0.id == editingItem.id }) {
                items[index] = updated
            }
            self.editingItem = nil
            editingTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteItem(_ item: AbroadPackingItem) async {
        do {
            try await SupabaseService.shared.deleteAbroadPackingItem(id: item.id)
            items.removeAll { $0.id == item.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
