import Foundation
import CoreLocation
import WidgetKit

/// 메인 앱에서 위치 저장 + 날씨 스냅샷 갱신 (위젯과 App Group 공유)
@MainActor
final class WeatherWidgetService: NSObject, CLLocationManagerDelegate {
    static let shared = WeatherWidgetService()

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func refreshWeatherWidget() async {
        let location = await requestLocationIfPossible()
        if let location {
            WidgetWeatherStore.saveLocation(
                WidgetWeatherLocation(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    updatedAt: Date()
                )
            )
        }

        let lat = WidgetWeatherStore.loadLocation()?.latitude
            ?? OpenMeteoWeatherClient.fallbackLatitude
        let lon = WidgetWeatherStore.loadLocation()?.longitude
            ?? OpenMeteoWeatherClient.fallbackLongitude

        do {
            let snapshot = try await OpenMeteoWeatherClient.fetchCurrent(latitude: lat, longitude: lon)
            WidgetWeatherStore.save(snapshot)
        } catch {
            // 캐시 유지
        }

        WidgetCenter.shared.reloadTimelines(ofKind: WidgetWeatherConstants.widgetKind)
    }

    private func requestLocationIfPossible() async -> CLLocation? {
        let status = manager.authorizationStatus
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            // 권한 팝업 직후에는 좌표가 없을 수 있음 — 다음 활성 시 재시도
            return nil
        case .authorizedWhenInUse, .authorizedAlways:
            return await withCheckedContinuation { cont in
                self.continuation = cont
                manager.requestLocation()
            }
        default:
            return nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            continuation?.resume(returning: locations.last)
            continuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            continuation?.resume(returning: nil)
            continuation = nil
        }
    }
}
