/** 일기 이미지에 글자·숫자·표지판 등이 나오지 않도록 하는 공통 제약 */
export const DIARY_IMAGE_PROMPT_SUFFIX =
  'Absolutely no text, no letters, no words, no numbers, no captions, no subtitles, no signs, no labels, no logos, no watermarks, no speech bubbles with writing, no typography, no readable symbols, no book pages with writing, no screens showing characters, purely visual illustration only.'

/** GPT 시스템 프롬프트용 글자 금지 규칙 */
export const DIARY_IMAGE_GPT_NO_TEXT_RULES = `- CRITICAL: The image must contain NO text, letters, words, numbers, captions, signs, labels, watermarks, logos, or typography in any language.
- Do NOT include speech bubbles, subtitles, newspapers, readable book pages, street signs, shop signs, phone screens with text, or UI elements with characters.
- Tell the story only through characters, objects, colors, and composition — never through written language.`

/**
 * 이미지 생성 API에 전달할 최종 프롬프트에 글자 금지 문구를 붙인다.
 * @param {string} prompt
 * @returns {string}
 */
export function finalizeDiaryImagePrompt(prompt) {
  const trimmed = (prompt || '').trim()
  if (!trimmed) return DIARY_IMAGE_PROMPT_SUFFIX
  if (trimmed.toLowerCase().includes('no text')) return trimmed
  return `${trimmed}. ${DIARY_IMAGE_PROMPT_SUFFIX}`
}
