import Foundation

struct ToeicVocabWord: Codable, Identifiable, Hashable {
    let id: Int
    let en: String
    let ko: String
}

struct ToeicVocabDay: Identifiable, Hashable {
    var id: Int { day }
    let day: Int
    let words: [ToeicVocabWord]
}

struct ToeicVocabData: Hashable {
    let source: String?
    let dayCount: Int
    let wordCount: Int
    let days: [ToeicVocabDay]

    static let wordsPerDay = 30

    private struct SourceFile: Decodable {
        let source: String?
        let dayCount: Int?
        let wordCount: Int?
        let days: [SourceDay]

        struct SourceDay: Decodable {
            let day: Int
            let words: [ToeicVocabWord]
        }
    }

    static func load(bundle: Bundle = .main) -> ToeicVocabData {
        guard
            let url = bundle.url(forResource: "toeicNorangiVocab", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let source = try? JSONDecoder().decode(SourceFile.self, from: data)
        else {
            return ToeicVocabData(source: nil, dayCount: 0, wordCount: 0, days: [])
        }
        return regroup(source: source, wordsPerDay: wordsPerDay)
    }

    private static func regroup(source: SourceFile, wordsPerDay: Int) -> ToeicVocabData {
        let allWords = source.days.flatMap(\.words)
        var days: [ToeicVocabDay] = []
        var index = 0
        while index < allWords.count {
            let end = min(index + wordsPerDay, allWords.count)
            let chunk = Array(allWords[index..<end])
            let dayNumber = days.count + 1
            let words = chunk.enumerated().map { offset, word in
                ToeicVocabWord(id: offset + 1, en: word.en, ko: word.ko)
            }
            days.append(ToeicVocabDay(day: dayNumber, words: words))
            index += wordsPerDay
        }
        return ToeicVocabData(
            source: source.source,
            dayCount: days.count,
            wordCount: allWords.count,
            days: days
        )
    }
}

enum ToeicVocabLocalStore {
    private static let completionsKey = "toeic-norangi-day-completions-v1"
    private static let selectedDayKey = "toeic-norangi-selected-day-v30"

    static func loadCompletions() -> [Int: Int] {
        guard
            let data = UserDefaults.standard.data(forKey: completionsKey),
            let raw = try? JSONDecoder().decode([String: Int].self, from: data)
        else { return [:] }
        var map: [Int: Int] = [:]
        for (key, value) in raw where value > 0 {
            if let day = Int(key) { map[day] = value }
        }
        return map
    }

    static func saveCompletions(_ map: [Int: Int]) {
        var raw: [String: Int] = [:]
        for (day, count) in map where count > 0 {
            raw[String(day)] = count
        }
        if let data = try? JSONEncoder().encode(raw) {
            UserDefaults.standard.set(data, forKey: completionsKey)
        }
    }

    static func loadSelectedDay(maxDay: Int) -> Int {
        let saved = UserDefaults.standard.integer(forKey: selectedDayKey)
        if saved >= 1, saved <= maxDay { return saved }
        return 1
    }

    static func saveSelectedDay(_ day: Int) {
        UserDefaults.standard.set(day, forKey: selectedDayKey)
    }
}

final class ToeicVocabRepository {
    static let shared = ToeicVocabRepository()
    let data: ToeicVocabData

    private init() {
        data = ToeicVocabData.load()
    }
}
