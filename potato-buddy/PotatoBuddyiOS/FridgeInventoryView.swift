import SwiftUI

struct FridgeInventoryView: View {
    @State private var activeStatus: FridgeItemStatus = .active
    @State private var allShelfItems: [FridgeItem] = []
    @State private var archiveItems: [FridgeItem] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showForm = false
    @State private var editingItem: FridgeItem?
    @State private var formZone: FridgeZone = .fridge
    @State private var statusChangeRequest: FridgeStatusChangeRequest?
    /** 목록 모드로 보는 구역 */
    @State private var listViewZones: Set<FridgeZone> = []
    @State private var updatingQuantityId: String?

    private var isActiveView: Bool {
        activeStatus == .active
    }

    private func shelfItems(for zone: FridgeZone) -> [FridgeItem] {
        allShelfItems.filter { $0.zone == zone.rawValue }
    }

    private func toggleListView(for zone: FridgeZone) {
        if listViewZones.contains(zone) {
            listViewZones.remove(zone)
        } else {
            listViewZones.insert(zone)
        }
    }

    private func openCreate(zone: FridgeZone = .fridge) {
        editingItem = nil
        formZone = zone
        showForm = true
    }

    private func openEdit(_ item: FridgeItem) {
        editingItem = item
        formZone = FridgeZone(rawValue: item.zone) ?? .fridge
        showForm = true
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                statusBar
                    .padding(.horizontal)
                    .padding(.vertical, 10)

                Group {
                    if isLoading && allShelfItems.isEmpty && archiveItems.isEmpty {
                        ProgressView("불러오는 중...")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if isActiveView {
                        ScrollView {
                            LazyVStack(spacing: 20) {
                                ForEach(FridgeZone.allCases) { zone in
                                    zoneSection(zone)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.bottom, 24)
                        }
                    } else if archiveItems.isEmpty {
                        emptyState
                    } else {
                        archiveList
                    }
                }
            }
            .navigationTitle("냉장고 관리")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if isActiveView {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            openCreate()
                        } label: {
                            Image(systemName: "plus")
                                .foregroundColor(.green)
                        }
                    }
                }
            }
            .refreshable {
                await loadData()
            }
            .sheet(isPresented: $showForm) {
                FridgeItemFormSheet(
                    zone: $formZone,
                    editingItem: editingItem,
                    onSave: { wasCreate in
                        showForm = false
                        editingItem = nil
                        if wasCreate, activeStatus != .active {
                            activeStatus = .active
                        }
                        await loadData()
                    },
                    onStatusChange: { item, next in
                        showForm = false
                        editingItem = nil
                        statusChangeRequest = FridgeStatusChangeRequest(item: item, nextStatus: next)
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
        .task(id: activeStatus.rawValue) {
            await loadData()
        }
    }

    @ViewBuilder
    private func zoneSection(_ zone: FridgeZone) -> some View {
        let zoneItems = shelfItems(for: zone)
        let showList = listViewZones.contains(zone)
        VStack(spacing: 8) {
            if showList {
                FridgeZoneListView(
                    zoneLabel: zone.label,
                    items: zoneItems,
                    updatingQuantityId: updatingQuantityId,
                    onQuantityChange: { item, next in
                        Task { await changeQuantity(item: item, to: next) }
                    },
                    onEdit: openEdit,
                    onComplete: { item in
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .completed
                        )
                    },
                    onDiscard: { item in
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .discarded
                        )
                    }
                )
            } else {
                FridgeShelfView(zone: zone, items: zoneItems) { item in
                    openEdit(item)
                }
            }

            HStack(spacing: 8) {
                Button {
                    toggleListView(for: zone)
                } label: {
                    Text(showList ? "그림으로 보기" : "목록으로 보기")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(showList ? Color(.systemGray5) : Color.blue.opacity(0.12))
                        .foregroundStyle(showList ? Color.primary : Color.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)

                Button {
                    openCreate(zone: zone)
                } label: {
                    Text("+ 추가")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.green.opacity(0.12))
                        .foregroundStyle(Color.green)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var statusBar: some View {
        Picker("상태", selection: $activeStatus) {
            ForEach(FridgeItemStatus.allCases) { status in
                Text(status.label).tag(status)
            }
        }
        .pickerStyle(.segmented)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("🧊")
                .font(.system(size: 48))
            Text("\(activeStatus.label) 상품이 없습니다.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var archiveList: some View {
        List {
            ForEach(archiveItems) { item in
                VStack(alignment: .leading, spacing: 8) {
                    Text(item.name)
                        .font(.headline)
                    HStack(spacing: 0) {
                        Text(FridgeZone(rawValue: item.zone)?.label ?? item.zone)
                        Text("  |  ")
                            .foregroundColor(.secondary.opacity(0.6))
                        Text("수량 \(item.quantity)")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)

                    Button("보관중으로") {
                        statusChangeRequest = FridgeStatusChangeRequest(
                            item: item,
                            nextStatus: .active
                        )
                    }
                    .buttonStyle(.bordered)
                    .tint(.green)
                    .font(.caption)
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.insetGrouped)
    }

    @MainActor
    private func loadData() async {
        isLoading = true
        errorMessage = ""
        defer { isLoading = false }

        do {
            if activeStatus == .active {
                allShelfItems = try await SupabaseService.shared.fetchFridgeItems(
                    status: FridgeItemStatus.active.rawValue
                )
                archiveItems = []
            } else {
                archiveItems = try await SupabaseService.shared.fetchFridgeItems(
                    status: activeStatus.rawValue
                )
            }
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }

    @MainActor
    private func changeQuantity(item: FridgeItem, to next: Int) async {
        guard next >= 1, updatingQuantityId == nil else { return }
        let previous = item.quantity
        guard next != previous else { return }

        updatingQuantityId = item.id
        let patch: (FridgeItem) -> FridgeItem = { row in
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
        let revert: (FridgeItem) -> FridgeItem = { row in
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
        allShelfItems = allShelfItems.map(patch)
        defer { updatingQuantityId = nil }

        do {
            _ = try await SupabaseService.shared.updateFridgeItem(id: item.id, quantity: next)
        } catch {
            allShelfItems = allShelfItems.map(revert)
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
            await loadData()
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

// MARK: - 구역 목록 뷰

private struct FridgeZoneListView: View {
    let zoneLabel: String
    let items: [FridgeItem]
    let updatingQuantityId: String?
    let onQuantityChange: (FridgeItem, Int) -> Void
    let onEdit: (FridgeItem) -> Void
    let onComplete: (FridgeItem) -> Void
    let onDiscard: (FridgeItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(zoneLabel) 목록")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(items.isEmpty ? "비어 있음" : "\(items.count)개")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if items.isEmpty {
                Text("등록된 상품이 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
            } else {
                ForEach(items) { item in
                    let expiry = FridgeExpiryDisplay.make(expiresAt: item.expiresAt)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.name)
                            .font(.headline)
                        HStack(spacing: 0) {
                            Text("등록 \(item.registeredAt)")
                            Text("  |  ")
                                .foregroundColor(.secondary.opacity(0.6))
                            Text("기한 ")
                            Text(expiry.text)
                                .foregroundColor(expiry.isExpired ? .red : (expiry.isUrgent ? .orange : .secondary))
                                .fontWeight(expiry.isUrgent ? .semibold : .regular)
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)

                        HStack(spacing: 8) {
                            FridgeQuantityStepper(
                                value: item.quantity,
                                disabled: updatingQuantityId == item.id,
                                onChange: { onQuantityChange(item, $0) }
                            )
                            Button("수정") { onEdit(item) }
                                .buttonStyle(.bordered)
                                .tint(.green)
                            Button("완료") { onComplete(item) }
                                .buttonStyle(.bordered)
                                .tint(.blue)
                            Button("폐기") { onDiscard(item) }
                                .buttonStyle(.bordered)
                                .tint(.orange)
                        }
                        .font(.caption)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.green.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.green.opacity(0.25), lineWidth: 2)
        )
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
    @Binding var zone: FridgeZone
    let editingItem: FridgeItem?
    let onSave: (_ wasCreate: Bool) async -> Void
    var onStatusChange: ((FridgeItem, FridgeItemStatus) -> Void)?
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
                Section("보관 구역") {
                    Picker("구역", selection: $zone) {
                        ForEach(FridgeZone.allCases) { z in
                            Text(z.label).tag(z)
                        }
                    }
                    .pickerStyle(.segmented)
                }

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

                if isEditing, let item = editingItem {
                    Section("상태") {
                        Button("완료") {
                            onStatusChange?(item, .completed)
                        }
                        Button("폐기") {
                            onStatusChange?(item, .discarded)
                        }
                        .foregroundStyle(.orange)
                    }
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
        zone = FridgeZone(rawValue: item.zone) ?? zone
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
            if !error.isCancellation { errorMessage = error.localizedDescription }
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
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
