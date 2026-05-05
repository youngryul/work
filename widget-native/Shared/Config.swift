import Foundation

/// Supabase 연결 설정
/// 변경이 필요한 경우 이 파일의 값을 수정하세요.
enum Config {
    static let supabaseURL = "https://dxerloskhvgmglxogtnw.supabase.co"
    static let serviceKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXJsb3NraHZnbWdseG9ndG53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAyNTI5MiwiZXhwIjoyMDY5NjAxMjkyfQ.7GYDm8Iv3S_zlCD-XFnOVXyeQ-7hJkj21feVFtSzvFg"
    static let userId      = "db7e6f70-ef35-49fc-b72e-e40dd788c1f9"
    static let websiteURL  = URL(string: "https://work-sable-one.vercel.app/")!
}