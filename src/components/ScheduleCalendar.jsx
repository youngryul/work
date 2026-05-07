import { useEffect, useMemo, useState } from 'react'
import {
  createSchedule,
  createScheduleTag,
  deleteSchedule,
  getOrCreateScheduleTagsForCurrentUser,
  getSchedulesByMonth,
  renameScheduleTagForUser,
  replaceScheduleTagForUser,
} from '../services/scheduleCalendarService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const TAG_COLOR_POOL = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
]

/**
 * 일정 달력 컴포넌트 (추가/삭제 전용)
 */
export default function ScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [tagSettings, setTagSettings] = useState([])
  const [newTag, setNewTag] = useState('기타')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showTagSettings, setShowTagSettings] = useState(false)
  const [editingTagName, setEditingTagName] = useState('')
  const [renameDrafts, setRenameDrafts] = useState({})
  const [newTagDraft, setNewTagDraft] = useState('')
  const [isUpdatingTag, setIsUpdatingTag] = useState(false)
  const [deletingTagName, setDeletingTagName] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    const tagNames = tagSettings.map((item) => item.name)
    if (tagNames.length > 0 && !tagNames.includes(newTag)) {
      setNewTag(tagNames[0])
    }
  }, [tagSettings, newTag])

  const loadSchedules = async () => {
    setIsLoading(true)
    try {
      const list = await getSchedulesByMonth(year, month)
      setSchedules(list)
    } catch (error) {
      console.error('일정 목록 로드 실패:', error)
      showToast('일정을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSchedules()
  }, [year, month])

  const loadTags = async () => {
    try {
      const tags = await getOrCreateScheduleTagsForCurrentUser()
      setTagSettings(tags)
      if (tags.length > 0) {
        setNewTag((prev) => (tags.some((t) => t.name === prev) ? prev : tags[0].name))
      }
    } catch (error) {
      console.error('태그 목록 로드 실패:', error)
      showToast('태그를 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    }
  }

  useEffect(() => {
    loadTags()
  }, [])

  const schedulesByDate = useMemo(() => {
    const map = new Map()
    schedules.forEach((item) => {
      const arr = map.get(item.scheduleDate) || []
      arr.push(item)
      map.set(item.scheduleDate, arr)
    })
    return map
  }, [schedules])

  const selectedSchedules = selectedDate ? (schedulesByDate.get(selectedDate) || []) : []
  const tagColorMap = useMemo(() => {
    const map = new Map()
    tagSettings.forEach((item) => map.set(item.name, item.color))
    return map
  }, [tagSettings])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
    setSelectedDate(null)
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setSelectedDate(dateText)
  }

  const handleAddSchedule = async () => {
    if (!selectedDate) {
      showToast('날짜를 먼저 선택해주세요.', TOAST_TYPES.INFO)
      return
    }
    if (!newTitle.trim()) {
      showToast('일정 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    setIsSaving(true)
    try {
      await createSchedule({
        scheduleDate: selectedDate,
        title: newTitle,
        tag: newTag,
      })
      setNewTitle('')
      await loadSchedules()
      showToast('일정이 추가되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('일정 등록 실패:', error)
      showToast('일정 등록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSchedule = async (scheduleId) => {
    setDeletingId(scheduleId)
    try {
      await deleteSchedule(scheduleId)
      await loadSchedules()
      showToast('일정을 삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('일정 삭제 실패:', error)
      showToast('일정 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartRenameTag = (tagName) => {
    setEditingTagName(tagName)
    setRenameDrafts((prev) => ({ ...prev, [tagName]: tagName }))
  }

  const handleRenameTag = async (oldName, newName) => {
    const nextName = (newName || '').trim()
    if (!nextName) {
      showToast('태그 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (tagSettings.some((tag) => tag.name === nextName && tag.name !== oldName)) {
      showToast('이미 존재하는 태그 이름입니다.', TOAST_TYPES.ERROR)
      return
    }

    setIsUpdatingTag(true)
    try {
      await renameScheduleTagForUser(oldName, nextName)
      await loadTags()
      setRenameDrafts((prev) => {
        const next = { ...prev }
        delete next[oldName]
        return next
      })
      if (newTag === oldName) {
        setNewTag(nextName)
      }
      setEditingTagName('')
      await loadSchedules()
      showToast('태그 이름이 변경되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('태그 이름 변경 실패:', error)
      showToast('태그 이름 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUpdatingTag(false)
    }
  }

  const handleDeleteTag = async (tagName) => {
    if (tagSettings.length <= 1) {
      showToast('태그는 최소 1개가 필요합니다.', TOAST_TYPES.ERROR)
      return
    }

    const hasEtcTag = tagSettings.some((tag) => tag.name === '기타')
    const fallbackTag = tagName === '기타'
      ? tagSettings.find((tag) => tag.name !== '기타')?.name || '기타'
      : hasEtcTag
        ? '기타'
        : tagSettings.find((tag) => tag.name !== tagName)?.name || '기타'

    setDeletingTagName(tagName)
    try {
      await replaceScheduleTagForUser(tagName, fallbackTag)
      await loadTags()
      if (newTag === tagName) {
        setNewTag(fallbackTag)
      }
      await loadSchedules()
      showToast(`"${tagName}" 태그를 삭제했습니다.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('태그 삭제 실패:', error)
      showToast('태그 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingTagName('')
    }
  }

  const handleAddTag = async () => {
    const nextTagName = (newTagDraft || '').trim()
    if (!nextTagName) {
      showToast('추가할 태그 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (tagSettings.some((tag) => tag.name === nextTagName)) {
      showToast('이미 존재하는 태그 이름입니다.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const randomColor = TAG_COLOR_POOL[Math.floor(Math.random() * TAG_COLOR_POOL.length)]
      await createScheduleTag({ name: nextTagName, color: randomColor })
      await loadTags()
      setNewTag(nextTagName)
      setNewTagDraft('')
      showToast('태그가 추가되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('태그 추가 실패:', error)
      showToast('태그 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const formatSelectedDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`
  }

  const generateCalendarCells = () => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()
    const cells = []

    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const daySchedules = schedulesByDate.get(dateString) || []
      const isSelected = selectedDate === dateString
      const isToday = (() => {
        const now = new Date()
        return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day
      })()

      cells.push(
        <button
          key={dateString}
          type="button"
          onClick={() => setSelectedDate(dateString)}
          className={`aspect-square rounded-xl border p-2 text-left transition-all ${
            isSelected
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{day}</span>
            {daySchedules.length > 0 && (
              <span className="text-[10px] font-semibold text-blue-600">
                {daySchedules.length}개
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1">
            {daySchedules.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className={`truncate rounded border px-1.5 py-0.5 text-[11px] ${tagColorMap.get(item.tag) || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                title={item.title}
              >
                {item.title}
              </div>
            ))}
          </div>
        </button>,
      )
    }

    return cells
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {year}년 {month}월
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrevMonth} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">이전</button>
            <button type="button" onClick={handleToday} className="px-3 py-1.5 rounded-lg border border-blue-300 text-sm text-blue-700 hover:bg-blue-50">오늘</button>
            <button type="button" onClick={handleNextMonth} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">다음</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 text-sm font-semibold text-gray-500">
          <div className="text-center">일</div>
          <div className="text-center">월</div>
          <div className="text-center">화</div>
          <div className="text-center">수</div>
          <div className="text-center">목</div>
          <div className="text-center">금</div>
          <div className="text-center">토</div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-gray-500">일정을 불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {generateCalendarCells()}
          </div>
        )}
      </section>

      <aside className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800">선택한 날짜</h3>
          <button
            type="button"
            onClick={() => setShowTagSettings(true)}
            className="text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 px-2 py-1 hover:bg-gray-50"
            title="태그 설정"
          >
            ⚙️
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {selectedDate ? formatSelectedDate(selectedDate) : '날짜를 선택하세요'}
        </p>

        <div className="space-y-2 mb-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="일정 제목"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {tagSettings.map((tag) => (
              <option key={tag.name} value={tag.name}>{tag.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddSchedule}
            disabled={isSaving || !selectedDate}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '추가 중...' : '일정 추가'}
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {selectedDate && selectedSchedules.length === 0 && (
            <p className="text-sm text-gray-400 py-2">등록된 일정이 없습니다.</p>
          )}
          {selectedSchedules.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold mb-1 ${tagColorMap.get(item.tag) || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    #{item.tag}
                  </p>
                  <p className="text-sm text-gray-800 break-words">{item.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(item.id)}
                  disabled={deletingId === item.id}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === item.id ? '삭제 중' : '삭제'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {showTagSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-800">태그 설정</h4>
              <button
                type="button"
                onClick={() => {
                  setShowTagSettings(false)
                  setEditingTagName('')
                  setRenameDrafts({})
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">태그 이름 변경 또는 삭제가 가능합니다.</p>
            <div className="mb-4 flex items-center gap-2">
              <input
                type="text"
                value={newTagDraft}
                onChange={(e) => setNewTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag()
                  }
                }}
                placeholder="새 태그 이름"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                추가
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tagSettings.map((tag) => (
                <div key={tag.name} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold ${tag.color}`}>
                      #{tag.name}
                    </span>
                    {editingTagName === tag.name ? (
                      <input
                        type="text"
                        value={renameDrafts[tag.name] ?? tag.name}
                        onChange={(e) => {
                          const value = e.target.value
                          setRenameDrafts((prev) => ({ ...prev, [tag.name]: value }))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameTag(tag.name, renameDrafts[tag.name] ?? tag.name)
                          }
                        }}
                        className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm"
                      />
                    ) : (
                      <p className="flex-1 text-sm text-gray-700">{tag.name}</p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {editingTagName === tag.name ? (
                      <>
                        <button
                          type="button"
                          disabled={isUpdatingTag}
                          onClick={() => {
                            setEditingTagName('')
                            setRenameDrafts((prev) => {
                              const next = { ...prev }
                              delete next[tag.name]
                              return next
                            })
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingTag}
                          onClick={(e) => {
                            handleRenameTag(tag.name, renameDrafts[tag.name] ?? tag.name)
                          }}
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                        >
                          저장
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartRenameTag(tag.name)}
                        className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        이름 변경
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingTagName === tag.name}
                      onClick={() => handleDeleteTag(tag.name)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingTagName === tag.name ? '삭제 중' : '삭제'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
