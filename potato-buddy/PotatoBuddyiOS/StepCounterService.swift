import CoreMotion
import Foundation

enum StepCounterService {
    static var isAvailable: Bool {
        CMPedometer.isStepCountingAvailable()
    }

    static var authorizationStatus: CMAuthorizationStatus {
        CMPedometer.authorizationStatus()
    }

    static var isAuthorized: Bool {
        authorizationStatus == .authorized
    }

    static var isDenied: Bool {
        authorizationStatus == .denied || authorizationStatus == .restricted
    }

    /// 오늘 0시부터 현재까지 걸음 수 조회
    static func fetchTodaySteps() async throws -> Int {
        guard isAvailable else { return 0 }

        let pedometer = CMPedometer()
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let now = Date()

        return try await withCheckedThrowingContinuation { continuation in
            pedometer.queryPedometerData(from: startOfDay, to: now) { data, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: data?.numberOfSteps.intValue ?? 0)
            }
        }
    }
}
