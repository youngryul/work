import SwiftUI

/// 과거 일기 상기 기능 (랜덤 일기 · 1년 전 오늘) 도우미. 표시 이력은 기기(UserDefaults)에만 저장한다.
enum DiaryMemory {
    private static let recentRandomKey = "diaryRandomRecentDates"
    private static let dismissedKey = "diaryMemoryDismissedDate"
    /// 최근에 보여준 랜덤 일기는 이 개수만큼 다시 뽑지 않음
    private static let recentRandomLimit = 10

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dateString(_ date: Date) -> String {
        isoFormatter.string(from: date)
    }

    static func date(from string: String) -> Date? {
        isoFormatter.date(from: string)
    }

    static var todayString: String { dateString(Date()) }

    /// 1년 전 같은 날짜 (2월 29일이면 2월 28일)
    static func oneYearAgoString(from today: Date = Date()) -> String {
        let calendar = Calendar(identifier: .gregorian)
        let date = calendar.date(byAdding: .year, value: -1, to: today) ?? today
        return dateString(date)
    }

    /// 과거 일기 날짜 중 하나를 랜덤으로 고른다 (최근에 본 날짜와 지금 보고 있는 날짜는 되도록 제외)
    static func pickRandomDate(from dates: [String], current: String? = nil) -> String? {
        guard !dates.isEmpty else { return nil }
        let defaults = UserDefaults.standard
        let recent = defaults.stringArray(forKey: recentRandomKey) ?? []
        // 일기가 적으면 최근 제외 개수를 줄여 후보가 남도록 함
        let excludeCount = min(recentRandomLimit, dates.count / 2)
        var excluded = Set(recent.prefix(excludeCount))
        if let current { excluded.insert(current) }

        var candidates = dates.filter { !excluded.contains($0) }
        if candidates.isEmpty { candidates = dates.filter { $0 != current } }
        if candidates.isEmpty { candidates = dates }

        guard let picked = candidates.randomElement() else { return nil }
        let next = [picked] + recent.filter { $0 != picked }
        defaults.set(Array(next.prefix(recentRandomLimit)), forKey: recentRandomKey)
        return picked
    }

    /// 오늘 '1년 전 오늘' 카드를 닫았는지
    static var isDismissedToday: Bool {
        UserDefaults.standard.string(forKey: dismissedKey) == todayString
    }

    /// 오늘 하루 '1년 전 오늘' 카드 숨기기
    static func dismissToday() {
        UserDefaults.standard.set(todayString, forKey: dismissedKey)
    }

    /// "2025년 10월 19일 (일)"
    static func displayLabel(for dateString: String) -> String {
        guard let date = date(from: dateString) else { return dateString }
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "yyyy년 M월 d일 (E)"
        return f.string(from: date)
    }
}

/// 다른 탭에서 특정 날짜 일기를 열어 달라는 요청 (MainTabView가 일기 탭으로 전환, DiaryCalendarView가 처리)
/// 화면 코드(메인 스레드)에서만 읽고 쓴다.
final class DiaryOpenRequest: ObservableObject {
    static let shared = DiaryOpenRequest()
    @Published var pendingDate: String?
}

/// 오늘 할일 상단의 '1년 전 오늘' 일기 카드. 1년 전 같은 날짜 일기가 있을 때만 보인다.
struct DiaryMemoryCardView: View {
    @State private var diary: DiaryItem?
    @State private var thumbnail: UIImage?

    var body: some View {
        // Group은 내용이 없으면 .task가 실행되지 않으므로 VStack으로 감싼다
        VStack(spacing: 0) {
            if let diary {
                Button {
                    DiaryOpenRequest.shared.pendingDate = diary.date
                } label: {
                    HStack(spacing: 12) {
                        thumbnailView
                        VStack(alignment: .leading, spacing: 4) {
                            Text("📅 1년 전 오늘의 일기")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color(red: 0.71, green: 0.42, blue: 0.05))
                            Text(previewText(diary))
                                .font(.system(size: 14))
                                .foregroundStyle(Color(red: 0.25, green: 0.23, blue: 0.2))
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                            Text("눌러서 다시 읽기 →")
                                .font(.system(size: 11))
                                .foregroundStyle(Color(red: 0.85, green: 0.47, blue: 0.02))
                        }
                        Spacer(minLength: 20)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(red: 1.0, green: 0.98, blue: 0.92).opacity(0.97))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color(red: 0.99, green: 0.83, blue: 0.5), lineWidth: 2)
                    )
                    .shadow(color: .black.opacity(0.12), radius: 6, y: 3)
                }
                .buttonStyle(.plain)
                .overlay(alignment: .topTrailing) {
                    Button {
                        DiaryMemory.dismissToday()
                        withAnimation { self.diary = nil }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color(red: 0.85, green: 0.6, blue: 0.3))
                            .padding(10)
                    }
                    .accessibilityLabel("오늘 하루 닫기")
                }
                .padding(.horizontal, 16)
            }
        }
        .task { await load() }
    }

    @ViewBuilder
    private var thumbnailView: some View {
        if let thumbnail {
            Image(uiImage: thumbnail)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .frame(width: 64, height: 64)
                .overlay(Text("📔").font(.system(size: 28)))
        }
    }

    private func previewText(_ diary: DiaryItem) -> String {
        let text = diary.content.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? "그날의 기록을 다시 열어 볼까요?" : text
    }

    private func load() async {
        guard diary == nil, !DiaryMemory.isDismissedToday else { return }
        guard let found = try? await SupabaseService.shared.fetchDiary(date: DiaryMemory.oneYearAgoString()) else { return }
        withAnimation { diary = found }
        if let urlString = found.thumbnailUrl, let url = URL(string: urlString),
           let (data, _) = try? await URLSession.shared.data(from: url) {
            thumbnail = UIImage(data: data)
        }
    }
}
