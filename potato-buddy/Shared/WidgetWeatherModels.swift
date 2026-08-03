import Foundation

// MARK: - 날씨 조건 (이미지 에셋과 1:1)

/// 위젯 배경 이미지용 날씨 종류.
/// 이미지는 `ScheduleWidget/Assets.xcassets/<assetName>.imageset/` 에 넣으면 됩니다.
enum WeatherCondition: String, Codable, CaseIterable, Identifiable {
    case clear
    case partlyCloudy
    case cloudy
    case rain
    case snow
    case thunderstorm
    case fog
    case unknown

    var id: String { rawValue }

    /// Assets.xcassets 이미지셋 이름
    var assetName: String {
        switch self {
        case .clear:         return "weather-clear"
        case .partlyCloudy:  return "weather-partly-cloudy"
        case .cloudy:        return "weather-cloudy"
        case .rain:          return "weather-rain"
        case .snow:          return "weather-snow"
        case .thunderstorm:  return "weather-thunderstorm"
        case .fog:           return "weather-fog"
        case .unknown:       return "weather-default"
        }
    }

    var koreanLabel: String {
        switch self {
        case .clear:         return "맑음"
        case .partlyCloudy:  return "구름 조금"
        case .cloudy:        return "흐림"
        case .rain:          return "비"
        case .snow:          return "눈"
        case .thunderstorm:  return "뇌우"
        case .fog:           return "안개"
        case .unknown:       return "날씨"
        }
    }

    /// Open-Meteo WMO weathercode → 조건
    static func fromWMO(_ code: Int) -> WeatherCondition {
        switch code {
        case 0:
            return .clear
        case 1, 2:
            return .partlyCloudy
        case 3:
            return .cloudy
        case 45, 48:
            return .fog
        case 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82:
            return .rain
        case 71, 73, 75, 77, 85, 86:
            return .snow
        case 95, 96, 99:
            return .thunderstorm
        default:
            return .unknown
        }
    }
}

enum WidgetWeatherConstants {
    static let appGroupId = WidgetScheduleConstants.appGroupId
    static let widgetKind = "WeatherWidget"
    static let snapshotKey = "widget.weather.snapshot"
    static let locationKey = "widget.weather.location"
}

struct WidgetWeatherLocation: Codable {
    let latitude: Double
    let longitude: Double
    let updatedAt: Date
}

struct WidgetWeatherSnapshot: Codable {
    let temperatureC: Double
    let condition: WeatherCondition
    let conditionLabel: String
    let locationLabel: String
    let updatedAt: Date

    static let placeholder = WidgetWeatherSnapshot(
        temperatureC: 22,
        condition: .clear,
        conditionLabel: WeatherCondition.clear.koreanLabel,
        locationLabel: "서울",
        updatedAt: Date()
    )

    var temperatureText: String {
        "\(Int(temperatureC.rounded()))°"
    }
}

enum WidgetWeatherStore {
    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: WidgetWeatherConstants.appGroupId)
    }

    static func save(_ snapshot: WidgetWeatherSnapshot) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: WidgetWeatherConstants.snapshotKey)
    }

    static func load() -> WidgetWeatherSnapshot? {
        guard
            let defaults,
            let data = defaults.data(forKey: WidgetWeatherConstants.snapshotKey)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetWeatherSnapshot.self, from: data)
    }

    static func saveLocation(_ location: WidgetWeatherLocation) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(location) else { return }
        defaults.set(data, forKey: WidgetWeatherConstants.locationKey)
    }

    static func loadLocation() -> WidgetWeatherLocation? {
        guard
            let defaults,
            let data = defaults.data(forKey: WidgetWeatherConstants.locationKey)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetWeatherLocation.self, from: data)
    }
}

// MARK: - Open-Meteo (API 키 불필요)

enum OpenMeteoWeatherClient {
    /// 기본 좌표 (위치 없을 때) — 서울시청 근처
    static let fallbackLatitude = 37.5665
    static let fallbackLongitude = 126.9780

    struct CurrentResponse: Decodable {
        let current: Current
        struct Current: Decodable {
            let temperature_2m: Double
            let weather_code: Int
        }
    }

    static func fetchCurrent(latitude: Double, longitude: Double) async throws -> WidgetWeatherSnapshot {
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(latitude)),
            URLQueryItem(name: "longitude", value: String(longitude)),
            URLQueryItem(name: "current", value: "temperature_2m,weather_code"),
            URLQueryItem(name: "timezone", value: "auto"),
        ]
        guard let url = components.url else { throw URLError(.badURL) }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(CurrentResponse.self, from: data)
        let condition = WeatherCondition.fromWMO(decoded.current.weather_code)
        return WidgetWeatherSnapshot(
            temperatureC: decoded.current.temperature_2m,
            condition: condition,
            conditionLabel: condition.koreanLabel,
            locationLabel: "",
            updatedAt: Date()
        )
    }
}
