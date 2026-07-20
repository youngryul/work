import SwiftUI

struct FridgeInventoryView: View {
    @State private var activeZone: FridgeZone = .fridge
    @State private var activeStatus: FridgeItemStatus = .active
    @State private var items: [FridgeItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showForm = false
    @State private var editingItem: FridgeItem?
    @State private var updatingQuantityId: String?
    @State private var statusChangeRequest: FridgeStatusChangeRequest?

    private var isActiveList: Bool {
        activeStatus == .active
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                zoneTabs
                Divider()
                statusBar
                    .padding(.horizontal)
                    .padding(.vertical, 10)

                Group {
                    if isLoading && items.isEmpty {
                        ProgressView("불러오는 중...")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if items.isEmpty {
                        emptyState
                    } else {
                        itemList
                    }
                }
            }
            .navigationTitle("냉장고 관리")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if isActiveList {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            editingItem = nil
                            showForm = true
                        } label: {
                            Image(systemName: "plus")
                                .foregroundColor(.green)
                        }
                    }
                }
            }
            .refreshable {
                await loadItems()
            }
            .sheet(isPresented: $showForm) {
                FridgeItemFormSheet(
                    zone: activeZone,
                    editingItem: editingItem,
                    onSave: { wasCreate in
                        showForm = false
                        editingItem = nil
                        if wasCreate, activeStatus != .active {
                            activeStatus = .active
                        }
                        await loadItems()
                    },
                    onCancel: {
                        showForm = false
                        editingItem = nil
                    }
                )
            }
            .confirmationDialog(
                statusChangeRequest?.title ?? "",
                isPresented: Binding(
                    get: { statusChangeRequest != nil },
                    set: { if !$0 { statusChangeRequest = nil } }
                ),
                titleVisibility: .visible
            ) {
                if let request = statusChangeRequest {
                    Button(request.confirmLabel) {
                        Task { await applyStatusChange(request) }
                    }
                    Button("취소", role: .cancel) {
                        statusChangeRequest = nil
                    }
                }
            } message: {
                if let request = statusChangeRequest {
                    Text(request.message)
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
        }
        .task(id: "\(activeZone.rawValue)-\(activeStatus.rawValue)") {
            await loadItems()
        }
    }

    private var zoneTabs: some View {
        Picker("구역", selection: $activeZone) {
            ForEach(FridgeZone.allCases) { zone in
                Text(zone.label).tag(zone)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private var statusBar: some View {
        HStack {
            Picker("상태", selection: $activeStatus) {
                ForEach(FridgeItemStatus.allCases) { status in
                    Text(status.label).tag(status)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("🧊")
                .font(.system(size: 48))
            Text(emptyMessage)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var emptyMessage: String {
        if isActiveList {
            return "등록된 상품이 없습니다."
        }
        return "\(activeStatus.label) 상품이 없습니다."
    }

    private var itemList: some View {
        List {
            ForEach(items) { item in
                FridgeItemRow(
                    item: item,
                    isActiveList: isActiveList,
                    isUpdatingQuantity: updatingQuantityId == item.id,
                    onQuantityChange: { next in
                        Task { await changeQuantity(item: item, to: next) }
                    },
                    onEdit: {
                        editingItem = item
                        showForm = true
                    },
                    onComplete: {
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .completed
                        )
                    },
                    onDiscard: {
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .discarded
                        )
                    },
                    onRestoreActive: {
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .active
                        )
                    }
                )
            }
        }
        .listStyle(.insetGrouped)
    }

    @MainActor
    private func loadItems() async {
        isLoading = true
        errorMessage = ""
        defer { isLoading = false }

        do {
            items = try await SupabaseService.shared.fetchFridgeItems(
                zone: activeZone.rawValue,
                status: activeStatus.rawValue
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func changeQuantity(item: FridgeItem, to next: Int) async {
        guard next >= 1, updatingQuantityId == nil else { return }
        let previous = item.quantity
        guard next != previous else { return }

        updatingQuantityId = item.id
        items = items.map { row in
            row.id == item.id ? FridgeItem(
                id: row.id,
                zone: row.zone,
                name: row.name,
                quantity: next,
                status: row.status,
                registeredAt: row.registeredAt,
                expiresAt: row.expiresAt
            ) : row
        }
        defer { updatingQuantityId = nil }

        do {
            _ = try await SupabaseService.shared.updateFridgeItem(id: item.id, quantity: next)
        } catch {
            items = items.map { row in
                row.id == item.id ? FridgeItem(
                    id: row.id,
                    zone: row.zone,
                    name: row.name,
                    quantity: previous,
                    status: row.status,
                    registeredAt: row.registeredAt,
                    expiresAt: row.expiresAt
                ) : row
            }
            errorMessage = "수량 변경에 실패했습니다."
        }
    }

    @MainActor
    private func applyStatusChange(_ request: FridgeStatusChangeRequest) async {
        statusChangeRequest = nil
        do {
            _ = try await SupabaseService.shared.updateFridgeItem(
                id: request.item.id,
                status: request.nextStatus.rawValue
            )
            await loadItems()
        } catch {
            errorMessage = "상태 변경에 실패했습니다."
        }
    }
}

private struct FridgeStatusChangeRequest {
    let item: FridgeItem
    let nextStatus: FridgeItemStatus

    var title: String { "상태 변경" }

    var message: String {
        "「\(item.name)」을(를) \(nextStatus.label)(으)로 변경할까요?"
    }

    var confirmLabel: String { "\(nextStatus.label)(으)로 변경" }
}

// MARK: - 행

private struct FridgeItemRow: View {
    let item: FridgeItem
    let isActiveList: Bool
    let isUpdatingQuantity: Bool
    let onQuantityChange: (Int) -> Void
    let onEdit: () -> Void
    let onComplete: () -> Void
    let onDiscard: () -> Void
    let onRestoreActive: () -> Void

    private var expiry: FridgeExpiryDisplay {
        FridgeExpiryDisplay.make(expiresAt: item.expiresAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(item.name)
                .font(.headline)

            HStack(spacing: 0) {
                Text("등록일 \(item.registeredAt)")
                Text("  |  ")
                    .foregroundColor(.secondary.opacity(0.6))
                Text("유통기한 ")
                Text(expiry.text)
                    .foregroundColor(expiryColor)
                    .fontWeight(expiry.isUrgent ? .semibold : .regular)
            }
            .font(.caption)
            .foregroundColor(.secondary)

            HStack(spacing: 8) {
                if isActiveList {
                    FridgeQuantityStepper(
                        value: item.quantity,
                        disabled: isUpdatingQuantity,
                        onChange: onQuantityChange
                    )
                    Button("수정", action: onEdit)
                        .buttonStyle(.bordered)
                        .tint(.green)
                    Button("완료", action: onComplete)
                        .buttonStyle(.bordered)
                        .tint(.blue)
                    Button("폐기", action: onDiscard)
                        .buttonStyle(.bordered)
                        .tint(.orange)
                } else {
                    Text("수량 \(item.quantity)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Button("보관중으로", action: onRestoreActive)
                        .buttonStyle(.bordered)
                        .tint(.green)
                }
            }
            .font(.caption)
        }
        .padding(.vertical, 4)
    }

    private var expiryColor: Color {
        if expiry.isExpired { return .red }
        if expiry.isUrgent { return .orange }
        return .secondary
    }
}

// MARK: - 수량 스테퍼

struct FridgeQuantityStepper: View {
    let value: Int
    var minValue: Int = 1
    var disabled: Bool = false
    let onChange: (Int) -> Void

    var body: some View {
        HStack(spacing: 6) {
            stepButton(label: "−") {
                onChange(max(minValue, value - 1))
            }
            .disabled(disabled || value <= minValue)

            Text("\(value)")
                .font(.subheadline.monospacedDigit())
                .frame(minWidth: 28)

            stepButton(label: "+") {
                onChange(value + 1)
            }
            .disabled(disabled)
        }
    }

    private func stepButton(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.title3.weight(.semibold))
                .frame(width: 32, height: 32)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 추가·수정 시트

private struct FridgeItemFormSheet: View {
    let zone: FridgeZone
    let editingItem: FridgeItem?
    let onSave: (_ wasCreate: Bool) async -> Void
    let onCancel: () -> Void

    @State private var name = ""
    @State private var quantity = 1
    @State private var registeredDate = Date()
    @State private var hasExpiry = false
    @State private var expiryDate = Date()
    @State private var isSaving = false
    @State private var showDeleteConfirm = false
    @State private var errorMessage = ""

    private var isEditing: Bool { editingItem != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("상품") {
                    TextField("상품명", text: $name)
                        .textInputAutocapitalization(.never)
                }

                Section("수량") {
                    FridgeQuantityStepper(value: quantity, disabled: isSaving) { quantity = $0 }
                }

                Section("등록 날짜") {
                    DatePicker(
                        "등록일",
                        selection: $registeredDate,
                        displayedComponents: .date
                    )
                    .environment(\.locale, Locale(identifier: "ko_KR"))
                }

                Section("유통기한") {
                    Toggle("유통기한 설정", isOn: $hasExpiry)
                    if hasExpiry {
                        DatePicker(
                            "유통기한",
                            selection: $expiryDate,
                            displayedComponents: .date
                        )
                        .environment(\.locale, Locale(identifier: "ko_KR"))
                    }
                }

                if isEditing {
                    Section {
                        Button("상품 삭제", role: .destructive) {
                            showDeleteConfirm = true
                        }
                    }
                }
            }
            .navigationTitle(isEditing ? "상품 수정" : "상품 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", action: onCancel)
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "수정" : "저장") {
                        Task { await save() }
                    }
                    .disabled(isSaving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                populateFromEditingItem()
            }
            .confirmationDialog(
                "상품 삭제",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) {
                    Task { await deleteItem() }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("「\(name)」을(를) 정말 삭제할까요?")
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
        .presentationDetents([.medium, .large])
    }

    private func populateFromEditingItem() {
        guard let item = editingItem else {
            name = ""
            quantity = 1
            registeredDate = FridgeDateHelper.date(from: FridgeDateHelper.todayYmd()) ?? Date()
            hasExpiry = false
            expiryDate = Date()
            return
        }
        name = item.name
        quantity = max(1, item.quantity)
        registeredDate = FridgeDateHelper.date(from: item.registeredAt) ?? Date()
        if let expires = item.expiresAt, !expires.isEmpty {
            hasExpiry = true
            expiryDate = FridgeDateHelper.date(from: expires) ?? Date()
        } else {
            hasExpiry = false
        }
    }

    @MainActor
    private func save() async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "상품명을 입력해주세요."
            return
        }

        isSaving = true
        defer { isSaving = false }

        let registeredAt = FridgeDateHelper.ymd(from: registeredDate)
        let expiresAt: String? = hasExpiry ? FridgeDateHelper.ymd(from: expiryDate) : nil

        do {
            if let item = editingItem {
                _ = try await SupabaseService.shared.updateFridgeItem(
                    id: item.id,
                    zone: zone.rawValue,
                    name: trimmed,
                    quantity: quantity,
                    registeredAt: registeredAt,
                    expiresAt: .some(hasExpiry ? FridgeDateHelper.ymd(from: expiryDate) : nil)
                )
                await onSave(false)
            } else {
                _ = try await SupabaseService.shared.createFridgeItem(
                    zone: zone.rawValue,
                    name: trimmed,
                    quantity: quantity,
                    registeredAt: registeredAt,
                    expiresAt: expiresAt
                )
                await onSave(true)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func deleteItem() async {
        guard let item = editingItem else { return }
        isSaving = true
        defer { isSaving = false }

        do {
            try await SupabaseService.shared.deleteFridgeItem(id: item.id)
            await onSave(false)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
