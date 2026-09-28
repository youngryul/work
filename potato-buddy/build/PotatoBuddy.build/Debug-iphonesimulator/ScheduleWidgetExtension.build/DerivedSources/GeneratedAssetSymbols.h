#import <Foundation/Foundation.h>

#if __has_attribute(swift_private)
#define AC_SWIFT_PRIVATE __attribute__((swift_private))
#else
#define AC_SWIFT_PRIVATE
#endif

/// The "weather-clear" asset catalog image resource.
static NSString * const ACImageNameWeatherClear AC_SWIFT_PRIVATE = @"weather-clear";

/// The "weather-cloudy" asset catalog image resource.
static NSString * const ACImageNameWeatherCloudy AC_SWIFT_PRIVATE = @"weather-cloudy";

/// The "weather-default" asset catalog image resource.
static NSString * const ACImageNameWeatherDefault AC_SWIFT_PRIVATE = @"weather-default";

/// The "weather-fog" asset catalog image resource.
static NSString * const ACImageNameWeatherFog AC_SWIFT_PRIVATE = @"weather-fog";

/// The "weather-partly-cloudy" asset catalog image resource.
static NSString * const ACImageNameWeatherPartlyCloudy AC_SWIFT_PRIVATE = @"weather-partly-cloudy";

/// The "weather-rain" asset catalog image resource.
static NSString * const ACImageNameWeatherRain AC_SWIFT_PRIVATE = @"weather-rain";

/// The "weather-snow" asset catalog image resource.
static NSString * const ACImageNameWeatherSnow AC_SWIFT_PRIVATE = @"weather-snow";

/// The "weather-thunderstorm" asset catalog image resource.
static NSString * const ACImageNameWeatherThunderstorm AC_SWIFT_PRIVATE = @"weather-thunderstorm";

#undef AC_SWIFT_PRIVATE
