import SwiftUI
import MapKit

/// MapKit 장소 자동완성 (Google API 키 없이도 사용)
@MainActor
final class PlaceSearchCompleter: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var results: [MKLocalSearchCompletion] = []
    @Published var isSearching = false

    private let completer = MKLocalSearchCompleter()
    private var countryCode: String = ""

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.pointOfInterest, .address]
    }

    func updateCountryCode(_ code: String) {
        countryCode = code.uppercased()
        // 여행 국가 중심으로 검색 편향
        if let region = preferredRegion(for: countryCode) {
            completer.region = region
        }
    }

    func search(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            results = []
            isSearching = false
            completer.queryFragment = ""
            return
        }
        isSearching = true
        completer.queryFragment = trimmed
    }

    func clear() {
        results = []
        isSearching = false
        completer.queryFragment = ""
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        Task { @MainActor in
            self.results = completer.results
            self.isSearching = false
        }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in
            self.results = []
            self.isSearching = false
        }
    }

    private func preferredRegion(for code: String) -> MKCoordinateRegion? {
        let center: CLLocationCoordinate2D?
        switch code {
        case "JP": center = .init(latitude: 35.6812, longitude: 139.7671)
        case "VN": center = .init(latitude: 10.8231, longitude: 106.6297)
        case "TH": center = .init(latitude: 13.7563, longitude: 100.5018)
        case "TW": center = .init(latitude: 25.0330, longitude: 121.5654)
        case "CN": center = .init(latitude: 31.2304, longitude: 121.4737)
        case "HK": center = .init(latitude: 22.3193, longitude: 114.1694)
        case "SG": center = .init(latitude: 1.3521, longitude: 103.8198)
        case "US": center = .init(latitude: 40.7128, longitude: -74.0060)
        case "GB": center = .init(latitude: 51.5074, longitude: -0.1278)
        case "FR": center = .init(latitude: 48.8566, longitude: 2.3522)
        case "DE": center = .init(latitude: 52.5200, longitude: 13.4050)
        case "IT": center = .init(latitude: 41.9028, longitude: 12.4964)
        case "ES": center = .init(latitude: 40.4168, longitude: -3.7038)
        case "AU": center = .init(latitude: -33.8688, longitude: 151.2093)
        case "PH": center = .init(latitude: 14.5995, longitude: 120.9842)
        case "MY": center = .init(latitude: 3.1390, longitude: 101.6869)
        case "ID": center = .init(latitude: -6.2088, longitude: 106.8456)
        case "AE": center = .init(latitude: 25.2048, longitude: 55.2708)
        case "CA": center = .init(latitude: 43.6532, longitude: -79.3832)
        case "NL": center = .init(latitude: 52.3676, longitude: 4.9041)
        default: center = nil
        }
        guard let center else { return nil }
        return MKCoordinateRegion(center: center, latitudinalMeters: 400_000, longitudinalMeters: 400_000)
    }
}
