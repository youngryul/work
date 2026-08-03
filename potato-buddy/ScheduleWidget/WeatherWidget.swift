import WidgetKit
import SwiftUI
import UIKit

struct WeatherWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetWeatherSnapshot
}

struct WeatherWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherWidgetEntry {
        WeatherWidgetEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherWidgetEntry) -> Void) {
        Task {
            let snapshot = await resolveSnapshot()
            completion(WeatherWidgetEntry(date: Date(), snapshot: snapshot))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherWidgetEntry>) -> Void) {
        Task {
            let snapshot = await resolveSnapshot()
            WidgetWeatherStore.save(snapshot)
            let entry = WeatherWidgetEntry(date: Date(), snapshot: snapshot)
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func resolveSnapshot() async -> WidgetWeatherSnapshot {
        if let cached = WidgetWeatherStore.load(),
           Date().timeIntervalSince(cached.updatedAt) < 10 * 60 {
            return cached
        }

        let location = WidgetWeatherStore.loadLocation()
        let lat = location?.latitude ?? OpenMeteoWeatherClient.fallbackLatitude
        let lon = location?.longitude ?? OpenMeteoWeatherClient.fallbackLongitude

        do {
            return try await OpenMeteoWeatherClient.fetchCurrent(latitude: lat, longitude: lon)
        } catch {
            return WidgetWeatherStore.load() ?? .placeholder
        }
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.snapshot.conditionLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.95))
                .shadow(color: .black.opacity(0.35), radius: 2, x: 0, y: 1)

            Spacer(minLength: 0)

            Text(entry.snapshot.temperatureText)
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
                .shadow(color: .black.opacity(0.4), radius: 4, x: 0, y: 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
    }

    @ViewBuilder
    var background: some View {
        ZStack {
            if UIImage(named: entry.snapshot.condition.assetName) != nil {
                Image(entry.snapshot.condition.assetName)
                    .resizable()
                    .scaledToFill()
            } else if UIImage(named: WeatherCondition.unknown.assetName) != nil {
                Image(WeatherCondition.unknown.assetName)
                    .resizable()
                    .scaledToFill()
            } else {
                Color(red: 0.35, green: 0.55, blue: 0.75)
            }

            LinearGradient(
                colors: [
                    Color.black.opacity(0.12),
                    Color.black.opacity(0.42),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

struct WeatherWidget: Widget {
    let kind: String = WidgetWeatherConstants.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherWidgetProvider()) { entry in
            WeatherWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WeatherWidgetView(entry: entry).background
                }
        }
        .configurationDisplayName("현재 날씨")
        .description("현재 온도와 날씨 이미지를 보여줍니다.")
        .supportedFamilies([.systemSmall])
    }
}
