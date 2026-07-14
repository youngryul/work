import SwiftUI

/// 여행별 기념품 체크리스트
struct TravelItinerarySouvenirListView: View {
    let tripId: String

    @State private var items: [AbroadSouvenirItem] = []
    @State private var draftTitle = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage = ""
    @State private var editingItem: AbroadSouvenirItem?
    @State private var editingTitle = ""

    private var checkedCount: Int {
        items.filter(\.isChecked).count
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("기념품")
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
                TextField("예: 키홀더, 과자...", text: $draftTitle)
                    .textFieldStyle(.roundedBorder)
                Button("추가") {
                    Task { await addItem() }
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .disabled(draftTitle.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            if isLoading {
                ProgressView("불러오는 중...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if items.isEmpty {
                Text("아직 기념품이 없습니다")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(items) { item in
                        souvenirRow(item)
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
    private func souvenirRow(_ item: AbroadSouvenirItem) -> some View {
        HStack(spacing: 12) {
            Button {
                Task { await toggle(item) }
            } label: {
                Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(item.isChecked ? .orange : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)

            if editingItem?.id == item.id {
                TextField("기념품", text: $editingTitle)
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
            items = try await SupabaseService.shared.fetchAbroadSouvenirItems(tripId: tripId)
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
            let created = try await SupabaseService.shared.createAbroadSouvenirItem(tripId: tripId, title: trimmed)
            items.append(created)
            draftTitle = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func toggle(_ item: AbroadSouvenirItem) async {
        let next = !item.isChecked
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = AbroadSouvenirItem(
                id: item.id,
                tripId: item.tripId,
                title: item.title,
                isChecked: next,
                sortOrder: item.sortOrder
            )
        }
        do {
            let updated = try await SupabaseService.shared.updateAbroadSouvenirItem(
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
            errorMessage = "기념품 이름을 입력해주세요."
            return
        }
        do {
            let updated = try await SupabaseService.shared.updateAbroadSouvenirItem(
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

    private func deleteItem(_ item: AbroadSouvenirItem) async {
        do {
            try await SupabaseService.shared.deleteAbroadSouvenirItem(id: item.id)
            items.removeAll { $0.id == item.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
