import Foundation
#if canImport(DeveloperToolsSupport)
import DeveloperToolsSupport
#endif

#if SWIFT_PACKAGE
private let resourceBundle = Foundation.Bundle.module
#else
private class ResourceBundleClass {}
private let resourceBundle = Foundation.Bundle(for: ResourceBundleClass.self)
#endif

// MARK: - Color Symbols -

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension DeveloperToolsSupport.ColorResource {

}

// MARK: - Image Symbols -

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension DeveloperToolsSupport.ImageResource {

    /// The "weather-clear" asset catalog image resource.
    static let weatherClear = DeveloperToolsSupport.ImageResource(name: "weather-clear", bundle: resourceBundle)

    /// The "weather-cloudy" asset catalog image resource.
    static let weatherCloudy = DeveloperToolsSupport.ImageResource(name: "weather-cloudy", bundle: resourceBundle)

    /// The "weather-default" asset catalog image resource.
    static let weatherDefault = DeveloperToolsSupport.ImageResource(name: "weather-default", bundle: resourceBundle)

    /// The "weather-fog" asset catalog image resource.
    static let weatherFog = DeveloperToolsSupport.ImageResource(name: "weather-fog", bundle: resourceBundle)

    /// The "weather-partly-cloudy" asset catalog image resource.
    static let weatherPartlyCloudy = DeveloperToolsSupport.ImageResource(name: "weather-partly-cloudy", bundle: resourceBundle)

    /// The "weather-rain" asset catalog image resource.
    static let weatherRain = DeveloperToolsSupport.ImageResource(name: "weather-rain", bundle: resourceBundle)

    /// The "weather-snow" asset catalog image resource.
    static let weatherSnow = DeveloperToolsSupport.ImageResource(name: "weather-snow", bundle: resourceBundle)

    /// The "weather-thunderstorm" asset catalog image resource.
    static let weatherThunderstorm = DeveloperToolsSupport.ImageResource(name: "weather-thunderstorm", bundle: resourceBundle)

}

