import { useState, useEffect, useCallback } from 'react'
import {
  GRADUATE_TIMETABLE_SEMESTERS,
  GRADUATE_SEMESTER_STORAGE_KEY,
  getGraduateSemesterById,
} from '../../constants/graduateTimetable.js'
import {
  fetchNotes,
  fetchNote,
  createNote,
  deleteNote,
} from '../../services/graduateService.js'
import GraduateNoteModal from './GraduateNoteModal.jsx'
import ViewPageTitle from '../ViewPageTitle.jsx'

/** 카테고리(보드 컬럼) 목록 */
const CATEGORIES = [
  { id: 'preview', label: '예습', icon: '📖', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  { id: 'lecture', label: '강의', icon: '🎓', dot: 'bg-sky-400', badge: 'bg-sky-50 text-sky-700' },
  { id: 'review', label: '복습', icon: '✏️', dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700' },
]

const EMPTY_NOTES_BY_CATEGORY = { preview: [], lecture: [], review: [] }

/**
 * 학기에서 과목 이름 목록을 추출한다.
 * @param {Object} semester
 * @returns {string[]}
 */
function getSubjectsFromSemester(semester) {
  if (!semester) return []
  const names = new Set()
  for (const day of semester.days ?? []) {
    for (const cls of Object.values(day.classes ?? {})) {
      names.add(cls.name)
    }
  }
  return Array.from(names)
}

/**
 * 날짜 문자열(YYYY-MM-DD)을 한국어 형식으로 변환
 * @param {string} dateStr
 */
function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${year}.${month}.${day}`
}

/**
 * 대학원 기록 메인 뷰 (노션 스타일 커버 + 과목 내비게이터 + 카테고리 보드)
 */
export default function GraduateNotesView() {
  // 현재 선택된 학기
  const [semesterId, setSemesterId] = useState(() => {
    return localStorage.getItem(GRADUATE_SEMESTER_STORAGE_KEY) ?? GRADUATE_TIMETABLE_SEMESTERS[0]?.id ?? ''
  })
  // 현재 선택된 과목
  const [selectedSubject, setSelectedSubject] = useState(null)
  // 카테고리별 노트 목록 { preview: [], lecture: [], review: [] }
  const [notesByCategory, setNotesByCategory] = useState(EMPTY_NOTES_BY_CATEGORY)
  const [notesLoading, setNotesLoading] = useState(false)
  // 팝업으로 열린 노트
  const [openNote, setOpenNote] = useState(null)
  // 생성 중인 카테고리
  const [creatingCategory, setCreatingCategory] = useState(null)
  // 삭제 확인 중인 노트 ID
  const [deletingId, setDeletingId] = useState(null)

  // 모바일 패널 단계 (0=과목, 1=보드)
  const [mobileStep, setMobileStep] = useState(0)

  const semester = getGraduateSemesterById(semesterId)
  const subjects = getSubjectsFromSemester(semester)

  // 학기 변경 시 과목 초기화
  useEffect(() => {
    setSelectedSubject(null)
    setOpenNote(null)
    setNotesByCategory(EMPTY_NOTES_BY_CATEGORY)
    setMobileStep(0)
  }, [semesterId])

  // 과목 변경 시 전체 카테고리 노트 목록 로드
  const loadNotes = useCallback(async () => {
    if (!selectedSubject || !semesterId) return
    setNotesLoading(true)
    try {
      const data = await fetchNotes({ semesterId, subjectName: selectedSubject })
      const grouped = { preview: [], lecture: [], review: [] }
      for (const n of data) {
        if (!grouped[n.category]) grouped[n.category] = []
        grouped[n.category].push(n)
      }
      setNotesByCategory(grouped)
    } catch (e) {
      console.error('노트 목록 로드 실패:', e)
    } finally {
      setNotesLoading(false)
    }
  }, [selectedSubject, semesterId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // 과목 선택
  const handleSelectSubject = (name) => {
    setSelectedSubject(name)
    setOpenNote(null)
    setMobileStep(1)
  }

  // 새 기록 생성 (컬럼별)
  const handleCreateNote = async (category) => {
    if (!selectedSubject || creatingCategory) return
    setCreatingCategory(category)
    try {
      const newNote = await createNote({
        semesterId,
        subjectName: selectedSubject,
        category,
        title: '',
        content: [],
        noteDate: new Date().toISOString().slice(0, 10),
      })
      setNotesByCategory((prev) => ({
        ...prev,
        [category]: [
          { id: newNote.id, title: newNote.title, note_date: newNote.note_date, category, created_at: newNote.created_at },
          ...prev[category],
        ],
      }))
      setOpenNote(newNote)
    } catch (e) {
      console.error('새 기록 생성 실패:', e)
      alert(`기록을 생성하지 못했습니다: ${e.message}`)
    } finally {
      setCreatingCategory(null)
    }
  }

  // 노트 선택 (팝업 열기) - 목록에는 content가 없으므로 단건 조회로 전체 내용을 가져온다
  const handleSelectNote = async (note) => {
    try {
      const fullNote = await fetchNote(note.id)
      setOpenNote(fullNote)
    } catch (e) {
      console.error('노트 상세 조회 실패:', e)
      alert(`기록을 불러오지 못했습니다: ${e.message}`)
    }
  }

  // 노트 삭제
  const handleDeleteNote = async (id, category) => {
    try {
      await deleteNote(id)
      setNotesByCategory((prev) => ({
        ...prev,
        [category]: prev[category].filter((n) => n.id !== id),
      }))
      if (openNote?.id === id) setOpenNote(null)
    } catch (e) {
      console.error('노트 삭제 실패:', e)
      alert(`삭제 실패: ${e.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // 팝업에서 저장될 때 카드 제목·날짜 갱신
  const handleNoteSaved = ({ id, title, note_date, category }) => {
    setNotesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].map((n) => (n.id === id ? { ...n, title, note_date } : n)),
    }))
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <ViewPageTitle icon="📝" title="대학원 기록" />

      {/* ===== 학기 선택 바 ===== */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className="text-xs text-gray-400 shrink-0">학기</span>
        <select
          value={semesterId}
          onChange={(e) => {
            setSemesterId(e.target.value)
            localStorage.setItem(GRADUATE_SEMESTER_STORAGE_KEY, e.target.value)
          }}
          className="text-sm border border-gray-200 rounded-full px-3 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        >
          {GRADUATE_TIMETABLE_SEMESTERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col md:flex-row gap-4 pb-10">
        {/* ===== 왼쪽 패널: 과목 내비게이터 ===== */}
        <div
          className={`
            md:w-56 md:shrink-0 border border-gray-100 rounded-xl bg-white
            ${mobileStep !== 0 ? 'hidden md:block' : ''}
          `}
        >
          <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
            Navigator
          </p>
          <div className="px-2 pb-3 space-y-0.5 max-h-96 overflow-y-auto">
            {subjects.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">과목 없음</p>
            ) : (
              subjects.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectSubject(name)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedSubject === name
                      ? 'bg-sky-50 text-sky-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm">📘</span>
                  <span className="truncate">{name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ===== 메인 보드: 카테고리별 칸반 컬럼 ===== */}
        <div
          className={`
            flex-1 min-w-0
            ${mobileStep !== 1 ? 'hidden md:block' : ''}
          `}
        >
          {!selectedSubject ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
              왼쪽에서 과목을 선택하세요.
            </div>
          ) : (
            <>
              {/* 모바일 뒤로가기 + 과목명 */}
              <div className="md:hidden flex items-center gap-2 px-1 pb-2">
                <button onClick={() => setMobileStep(0)} className="text-sm text-sky-600">
                  ← 과목
                </button>
                <span className="text-sm font-medium text-gray-700 ml-2 truncate">{selectedSubject}</span>
              </div>

              {/* 과목명 헤더 (데스크톱) */}
              <div className="hidden md:block px-1 pb-3">
                <h2 className="text-2xl font-sans text-sky-700">{selectedSubject}</h2>
              </div>

              {/* 칸반 보드 */}
              <div>
                {notesLoading ? (
                  <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                    불러오는 중...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {CATEGORIES.map((cat) => {
                      const notes = notesByCategory[cat.id] ?? []
                      return (
                        <div
                          key={cat.id}
                          className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col overflow-hidden"
                        >
                          {/* 컬럼 헤더 */}
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                            <span className="text-sm font-semibold text-gray-800">{cat.icon} {cat.label}</span>
                            <span className={`ml-auto text-xs font-medium rounded-full px-2 py-0.5 ${cat.badge}`}>
                              {notes.length}
                            </span>
                          </div>

                          {/* 카드 목록 */}
                          <div className="flex-1 px-2 py-2 space-y-1.5 min-h-[80px]">
                            {notes.length === 0 ? (
                              <p className="text-xs text-gray-300 text-center py-6">기록이 없습니다.</p>
                            ) : (
                              notes.map((note) => (
                                <div
                                  key={note.id}
                                  onClick={() => handleSelectNote(note)}
                                  className="group relative flex items-start gap-1 px-3 py-2.5 rounded-lg cursor-pointer border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate ${note.title ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                                      {note.title || '제목 없음'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(note.note_date)}</p>
                                  </div>
                                  {/* 삭제 버튼 */}
                                  {deletingId === note.id ? (
                                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => handleDeleteNote(note.id, cat.id)}
                                        className="text-xs text-red-500 hover:text-red-700 px-1"
                                      >
                                        삭제
                                      </button>
                                      <button
                                        onClick={() => setDeletingId(null)}
                                        className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeletingId(note.id) }}
                                      className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-300 hover:text-red-400 text-xs px-1 transition-opacity"
                                      title="삭제"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* 새 기록 버튼 */}
                          <button
                            onClick={() => handleCreateNote(cat.id)}
                            disabled={creatingCategory === cat.id}
                            className="flex items-center justify-center gap-1 mx-2 mb-2 py-1.5 text-sm text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <span className="text-base leading-none">+</span>
                            <span>{creatingCategory === cat.id ? '생성 중...' : '새 기록'}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== 팝업 에디터 ===== */}
      {openNote && (
        <GraduateNoteModal
          note={openNote}
          onClose={() => setOpenNote(null)}
          onSaved={handleNoteSaved}
          onDelete={() => handleDeleteNote(openNote.id, openNote.category)}
        />
      )}
    </div>
  )
}
