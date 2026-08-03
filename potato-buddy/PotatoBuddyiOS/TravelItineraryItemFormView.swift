import SwiftUI
import MapKit

struct TravelItineraryItemFormView: View {
    let trip: AbroadTrip
    let selectedDate: String
    let editingItem: AbroadItineraryItem?
    let movingSpareItem: AbroadSpareItem?
    let onSaved: (_ movedItemDate: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var placeSearch = PlaceSearchCompleter()

    @State private var title = ""
    @State private var memo = ""
    @State private var itemDate = ""
    @State private var startMinute = 540
    @State private var endMinute = 570
    @State private var placeName = ""
    @State private var placeAddress = ""
    @State private var placeLat: Double?
    @State private var placeLng: Double?
    @State private var googlePlaceId = ""
    @State private var isSaving = false
    @State private var isResolvingPlace = false
    @State private var isApplyingPlaceSelection = false
    @State private var errorMessage = ""
    @State private var showPlaceSuggestions = false

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
                }

                Section {
                    TextField("장소 검색 / 직접 입력", text: $placeName)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                        .onChange(of: placeName) { _, newValue in
                            guard !isApplyingPlaceSelection else { return }
                            // 직접 타이핑 시 좌표/장소ID는 초기화 (선택으로 다시 채움)
                            placeLat = nil
                            placeLng = nil
                            googlePlaceId = ""
                            showPlaceSuggestions = true
                            placeSearch.search(newValue)
                        }

                    if !placeAddress.isEmpty {
                        Text(placeAddress)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    TextField("주소 (선택)", text: $placeAddress)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)

                    if showPlaceSuggestions && (!placeSearch.results.isEmpty || placeSearch.isSearching || isResolvingPlace) {
                        if placeSearch.isSearching || isResolvingPlace {
                            Text(isResolvingPlace ? "장소 확인 중..." : "검색 중...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        ForEach(Array(placeSearch.results.prefix(8).enumerated()), id: \.offset) { _, completion in
                            Button {
                                Task { await selectCompletion(completion) }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(completion.title)
                                        .foregroundColor(.primary)
                                    if !completion.subtitle.isEmpty {
                                        Text(completion.subtitle)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                    }

                    if !placeName.isEmpty || !placeAddress.isEmpty {
                        Button("장소 지우기", role: .destructive) {
                            clearPlace()
                        }
                    }
                } header: {
                    Text("장소 (구글 지도)")
                } footer: {
                    Text("장소를 저장하면 일정에서 구글 지도로 바로 열 수 있습니다.")
                }

                Section("메모") {
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
                placeSearch.updateCountryCode(trip.countryCode)
                if let editingItem {
                    title = editingItem.title
                    memo = editingItem.memo ?? ""
                    itemDate = editingItem.itemDate
                    startMinute = editingItem.startMinute
                    endMinute = editingItem.endMinute
                    placeName = editingItem.placeName ?? ""
                    placeAddress = editingItem.placeAddress ?? ""
                    placeLat = editingItem.placeLat
                    placeLng = editingItem.placeLng
                    googlePlaceId = editingItem.googlePlaceId ?? ""
                } else if let movingSpareItem {
                    title = movingSpareItem.title
                    memo = ""
                    itemDate = selectedDate.isEmpty ? (dateOptions.first ?? "") : selectedDate
                    startMinute = 540
                    endMinute = 570
                    clearPlace()
                } else {
                    itemDate = selectedDate.isEmpty ? (dateOptions.first ?? "") : selectedDate
                    startMinute = 540
                    endMinute = 570
                    clearPlace()
                }
            }
            .onChange(of: startMinute) { _, newValue in
                if endMinute <= newValue {
                    endMinute = min(1440, newValue + 30)
                }
            }
        }
    }

    private func clearPlace() {
        placeName = ""
        placeAddress = ""
        placeLat = nil
        placeLng = nil
        googlePlaceId = ""
        showPlaceSuggestions = false
        placeSearch.clear()
    }

    private func selectCompletion(_ completion: MKLocalSearchCompletion) async {
        isResolvingPlace = true
        defer { isResolvingPlace = false }
        showPlaceSuggestions = false
        placeSearch.clear()

        let request = MKLocalSearch.Request(completion: completion)
        do {
            let response = try await MKLocalSearch(request: request).start()
            if let mapItem = response.mapItems.first {
                isApplyingPlaceSelection = true
                placeName = mapItem.name ?? completion.title
                placeAddress = mapItem.placemark.title ?? completion.subtitle
                placeLat = mapItem.placemark.coordinate.latitude
                placeLng = mapItem.placemark.coordinate.longitude
                googlePlaceId = ""
                isApplyingPlaceSelection = false
                return
            }
        } catch {
            // 검색 실패 시 제목/부제목만 저장
        }
        isApplyingPlaceSelection = true
        placeName = completion.title
        placeAddress = completion.subtitle
        placeLat = nil
        placeLng = nil
        googlePlaceId = ""
        isApplyingPlaceSelection = false
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
                    memo: memo,
                    placeName: placeName,
                    placeAddress: placeAddress,
                    placeLat: placeLat,
                    placeLng: placeLng,
                    googlePlaceId: googlePlaceId
                )
                onSaved(nil)
            } else if let movingSpareItem {
                _ = try await SupabaseService.shared.createAbroadItineraryItem(
                    tripId: trip.id,
                    itemDate: itemDate,
                    startMinute: startMinute,
                    endMinute: endMinute,
                    title: trimmed,
                    memo: memo,
                    placeName: placeName,
                    placeAddress: placeAddress,
                    placeLat: placeLat,
                    placeLng: placeLng,
                    googlePlaceId: googlePlaceId
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
                    memo: memo,
                    placeName: placeName,
                    placeAddress: placeAddress,
                    placeLat: placeLat,
                    placeLng: placeLng,
                    googlePlaceId: googlePlaceId
                )
                onSaved(nil)
            }
            dismiss()
        } catch {
            if !error.isCancellation { errorMessage = error.localizedDescription }
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
            if !error.isCancellation { errorMessage = error.localizedDescription }
        }
    }
}
