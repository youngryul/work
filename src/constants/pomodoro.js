/**
 * 오늘 할 일 → 뽀모도로로 넘길 할 일 정보 (sessionStorage 키)
 * 값: JSON { id: string, title: string }
 */
export const POMODORO_LINKED_TASK_STORAGE_KEY = 'pomodoroLinkedTask'

/**
 * 뽀모도로를 시작할 할 일을 저장하고 뽀모도로 화면으로 이동
 * @param {{ id: string, title: string }} task
 */
export function openPomodoroForTask(task) {
  try {
    sessionStorage.setItem(
      POMODORO_LINKED_TASK_STORAGE_KEY,
      JSON.stringify({ id: task.id, title: task.title }),
    )
  } catch {
    // 저장 실패 시 할 일 연결 없이 뽀모도로만 열림
  }
  window.setCurrentView?.('pomodoro')
}

/**
 * 저장된 연결 할 일 읽기 (지우지 않음 — StrictMode에서 초기화 함수가 두 번 불려도 안전)
 * @returns {{ id: string, title: string } | null}
 */
export function readPomodoroLinkedTask() {
  try {
    const raw = sessionStorage.getItem(POMODORO_LINKED_TASK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id ? { id: parsed.id, title: parsed.title || '' } : null
  } catch {
    return null
  }
}

/**
 * 연결 할 일 지우기 (뽀모도로 화면에서 읽은 뒤 호출)
 */
export function clearPomodoroLinkedTask() {
  try {
    sessionStorage.removeItem(POMODORO_LINKED_TASK_STORAGE_KEY)
  } catch {
    // 무시
  }
}
