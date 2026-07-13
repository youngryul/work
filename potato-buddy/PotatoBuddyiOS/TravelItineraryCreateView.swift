import SwiftUI

struct TravelItineraryCreateView: View {
    let onCreated: (AbroadTrip) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var countryCode = "JP"
    @State private var countrySearch = ""
    @State private var departureDate = Date()
    @State private var returnDate = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var isSaving = false
    @State private var errorMessage = ""

    private var filteredCountries: [TravelAbroadCountry] {
        let q = countrySearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return TravelAbroadCountry.options }
        return TravelAbroadCountry.options.filter {
            $0.name.lowercased().contains(q) || $0.code.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationView {
            Form {
                Section("여행 정보") {
                    TextField("제목 (예: 도쿄 3박 4일)", text: $title)
                }

                Section("여행 국가") {
                    TextField("국가 검색", text: $countrySearch)
                    Picker("국가", selection: $countryCode) {
                        ForEach(filteredCountries) { country in
                            Text("\(country.name) (\(country.code))").tag(country.code)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section("비행기 일정") {
                    DatePicker("출발", selection: $departureDate)
                    DatePicker("귀국", selection: $returnDate)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("해외 여행 등록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("등록") {
                        Task { await save() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        errorMessage = ""

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let departureAt = formatter.string(from: departureDate)
        let returnAt = formatter.string(from: returnDate)

        guard returnDate > departureDate else {
            errorMessage = "귀국 시각은 출국 시각보다 늦어야 합니다."
            return
        }

        do {
            let trip = try await SupabaseService.shared.createAbroadTrip(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                countryCode: countryCode,
                departureAt: departureAt,
                returnAt: returnAt
            )
            onCreated(trip)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
