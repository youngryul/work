import Foundation

extension Error {
    /// SwiftUI `.task` / `.refreshable` 등으로 요청이 취소된 경우
    var isCancellation: Bool {
        if self is CancellationError { return true }
        if let urlError = self as? URLError, urlError.code == .cancelled { return true }

        let nsError = self as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return true
        }
        // Supabase 등에서 URLError를 래핑한 경우
        if let underlying = nsError.userInfo[NSUnderlyingErrorKey] as? Error {
            if underlying is CancellationError { return true }
            if let urlError = underlying as? URLError, urlError.code == .cancelled { return true }
            let underlyingNS = underlying as NSError
            if underlyingNS.domain == NSURLErrorDomain && underlyingNS.code == NSURLErrorCancelled {
                return true
            }
        }

        // 로케일/래핑에 따라 메시지만 "cancelled"로 오는 경우
        let message = localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if message == "cancelled" || message == "canceled" || message == "취소됨" {
            return true
        }
        return false
    }
}
