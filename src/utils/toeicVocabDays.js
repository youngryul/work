/**
 * 토익 노랭이 단어를 Day당 고정 개수로 재구성
 */

export const WORDS_PER_DAY = 30

/**
 * @typedef {{ id: number, en: string, ko: string }} VocabWord
 * @typedef {{ day: number, words: VocabWord[] }} VocabDay
 * @typedef {{ source?: string, dayCount: number, wordCount: number, days: VocabDay[] }} VocabData
 */

/**
 * 원본 day 묶음을 풀어 Day당 {@link WORDS_PER_DAY}개로 다시 나눕니다.
 * @param {VocabData} source
 * @param {number} [wordsPerDay=WORDS_PER_DAY]
 * @returns {VocabData}
 */
export function regroupVocabByDaySize(source, wordsPerDay = WORDS_PER_DAY) {
  const allWords = (source.days ?? []).flatMap((day) => day.words ?? [])
  /** @type {VocabDay[]} */
  const days = []

  for (let i = 0; i < allWords.length; i += wordsPerDay) {
    const chunk = allWords.slice(i, i + wordsPerDay)
    days.push({
      day: days.length + 1,
      words: chunk.map((word, index) => ({
        id: index + 1,
        en: word.en,
        ko: word.ko,
      })),
    })
  }

  return {
    source: source.source,
    dayCount: days.length,
    wordCount: allWords.length,
    days,
  }
}
