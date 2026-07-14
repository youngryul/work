import SwiftUI

struct TravelItineraryItemFormView: View {
    let trip: AbroadTrip
    let selectedDate: String
    let editingItem: AbroadItineraryItem?
    let movingSpareItem: AbroadSpareItem?
    let onSaved: (_ movedItemDate: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var memo = ""
    @State private var itemDate = ""
    @State private var startMinute = 540
    @State private var endMinute = 570
    @State private var isSaving = false
    @State private var errorMessage = ""

    private var startOptions: [Int] {
        TravelItineraryTime.halfHourOptions.filter { $0 < 1440 }
    }

    private var endOptions: [Int] {
        TravelItineraryTime.halfHourOptions.filter { $0 > startMinute }
    }

    private var dateOptions: [String] {
        TravelItineraryTime.dateKeys(from: trip.departureAt, to: trip.returnAt)
    }

    private var navigationTitleText: String {
        if editingItem != nil { return "일정 수정" }
        if movingSpareItem != nil { return "예비 → 일정" }
        return "일정 추가"
    }

    var body: some View {
        NavigationView {
            Form {
                Section("일정") {
                    TextField("제목", text: $title)

                    Picker("날짜", selection: $itemDate) {
                        ForEach(dateOptions, id: \.self) { date in
                            Text(date).tag(date)
                        }
                    }

                    Picker("시작", selection: $startMinute) {
                        ForEach(startOptions, id: \.self) { minute in
                            Text(TravelItineraryTime.minuteToLabel(minute)).tag(minute)
                        }
                    }

                    Picker("종료", selection: $endMinute) {
                        ForEach(endOptions, id: \.self) { minute in
                            Text(TravelItineraryTime.minuteToLabel(minute)).tag(minute)
                        }
                    }

                    TextField("메모", text: $memo, axis: .vertical)
                        .lineLimit(3...6)
                }

                if editingItem != nil {
                    Section {
                        Button("삭제", role: .destructive) {
                            Task { await deleteItem() }
                        }
                    }
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(navigationTitleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(movingSpareItem != nil ? "옮기기" : "저장") {
                        Task { await save() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear {
                if let editingItem {
                    title = editingItem.title
                    memo = editingItem.memo ?? ""
                    itemDate = editingItem.itemDate
                    startMinute = editingItem.startMinute
                    endMinute = editingItem.endMinute
                } else if let movingSpareItem {
                    title = movingSpareItem.title
                    memo = ""
                    itemDate = selectedDate.isEmpty ? (dateOptions.first ?? "") : selectedDate
                    startMinute = 540
                    endMinute = 570
                } else {
                    itemDate = selectedDate.isEmpty ? (dateOptions.first ?? "") : selectedDate
                    startMinute = 540
                    endMinute = 570
                }
            }
            .onChange(of: startMinute) { _, newValue in
                if endMinute <= newValue {
                    endMinute = min(1440, newValue + 30)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        errorMessage = ""

        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        do {
            if let editingItem {
                _ = try await SupabaseService.shared.updateAbroadItineraryItem(
                    id: editingItem.id,
                    itemDate: itemDate,
                    startMinute: startMinute,
                    endMinute: endMinute,
                    title: trimmed,
                    memo: memo
                )
                onSaved(nil)
            } else if let movingSpareItem {
                _ = try await SupabaseService.shared.createAbroadItineraryItem(
                    tripId: trip.id,
                    itemDate: itemDate,
                    startMinute: startMinute,
                    endMinute: endMinute,
                    title: trimmed,
                    memo: memo
                )
                try await SupabaseService.shared.deleteAbroadSpareItem(id: movingSpareItem.id)
                onSaved(itemDate)
            } else {
                _ = try await SupabaseService.shared.createAbroadItineraryItem(
                    tripId: trip.id,
                    itemDate: itemDate,
                    startMinute: startMinute,
                    endMinute: endMinute,
                    title: trimmed,
                    memo: memo
                )
                onSaved(nil)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteItem() async {
        guard let editingItem else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await SupabaseService.shared.deleteAbroadItineraryItem(id: editingItem.id)
            onSaved(nil)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
