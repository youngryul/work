import Foundation

/// Supabase 연결 설정
enum Config {
    static let supabaseURL = "https://dxerloskhvgmglxogtnw.supabase.co"
    static let anonKey     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXJsb3NraHZnbWdseG9ndG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjUyOTIsImV4cCI6MjA2OTYwMTI5Mn0.w3mwCyOiBcV9ju9lF8BgP6NPiS6uXStLlor6-7-eTsY"
    static let serviceKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXJsb3NraHZnbWdseG9ndG53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAyNTI5MiwiZXhwIjoyMDY5NjAxMjkyfQ.7GYDm8Iv3S_zlCD-XFnOVXyeQ-7hJkj21feVFtSzvFg"
    static let websiteURL  = URL(string: "https://work-sable-one.vercel.app/")!

    /// Info.plist `OPENAI_API_KEY` (비어 있거나 $(...)면 미설정)
    static var openAIAPIKey: String {
        if let key = Bundle.main.object(forInfoDictionaryKey: "OPENAI_API_KEY") as? String {
            let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !trimmed.hasPrefix("$(") {
                return trimmed
            }
        }
        return ""
    }

    /// 냉장고 메뉴 추천 1회 토큰 비용
    static let menuRecommendTokenCost = 1
}
