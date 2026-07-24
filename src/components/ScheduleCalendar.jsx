import { useEffect, useMemo, useState } from 'react'
import {
  createSchedule,
  createScheduleTag,
  deleteSchedule,
  describeScheduleRepeat,
  getOrCreateScheduleTagsForCurrentUser,
  getSchedulesByMonth,
  MAX_SCHEDULE_RANGE_DAYS,
  renameScheduleTagForUser,
  replaceScheduleTagForUser,
  updateScheduleDate,
} from '../services/scheduleCalendarService.js'
import { buildDefaultRepeatFormState } from '../utils/scheduleRepeat.js'
import ScheduleRepeatEditor from './schedule/ScheduleRepeatEditor.jsx'
import {
  getMenstrualCycleSettings,
  getPeriodRecordsInRange,
  saveMenstrualFeaturePreference,
} from '../services/menstrualCycleService.js'
import { MENSTRUAL_MARKER_TYPE, MENSTRUAL_PREDICTION_MONTHS } from '../constants/menstrualCycle.js'
import {
  buildMenstrualDateMarkers,
  getMonthDateRange,
} from '../utils/menstrualCycleCalendar.js'
import MenstrualCyclePanel from './schedule/MenstrualCyclePanel.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * Date → YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDateString() {
  return toDateString(new Date())
}

/**
 * @param {{ scheduleDate: string, endDate?: string }} schedule
 * @returns {string}
 */
function getScheduleEndDate(schedule) {
  return schedule.endDate || schedule.scheduleDate
}

/**
 * @param {{ scheduleDate: string, endDate?: string }} schedule
 * @returns {boolean}
 */
function isMultiDaySchedule(schedule) {
  return getScheduleEndDate(schedule) !== schedule.scheduleDate
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string[]}
 */
function enumerateDateRange(startDate, endDate) {
  const dates = []
  const current = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  while (current <= last) {
    dates.push(toDateString(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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
  const [selectedDate, setSelectedDate] = useState(getTodayDateString)
  const [addScheduleDate, setAddScheduleDate] = useState(getTodayDateString)
  const [addScheduleEndDate, setAddScheduleEndDate] = useState(getTodayDateString)
  const [isRangeSchedule, setIsRangeSchedule] = useState(false)
  const [repeatForm, setRepeatForm] = useState(() =>
    buildDefaultRepeatFormState(getTodayDateString()),
  )
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
  const [editingScheduleId, setEditingScheduleId] = useState('')
  const [editStartDateDraft, setEditStartDateDraft] = useState('')
  const [editEndDateDraft, setEditEndDateDraft] = useState('')
  const [updatingScheduleId, setUpdatingScheduleId] = useState('')
  const [cycleSettings, setCycleSettings] = useState(null)
  const [periodRecords, setPeriodRecords] = useState([])
  const [isMenstrualLoading, setIsMenstrualLoading] = useState(true)
  const [isSavingMenstrualToggle, setIsSavingMenstrualToggle] = useState(false)
  const [showMenstrualOnboarding, setShowMenstrualOnboarding] = useState(false)

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

  const loadMenstrualData = async () => {
    setIsMenstrualLoading(true)
    try {
      const visibleRange = getMonthDateRange(year, month, 0)
      const predictionRange = getMonthDateRange(year, month, MENSTRUAL_PREDICTION_MONTHS)
      const settings = await getMenstrualCycleSettings()
      const records = settings.isEnabled
        ? await getPeriodRecordsInRange(visibleRange.rangeStart, predictionRange.rangeEnd)
        : []
      setCycleSettings(settings)
      setPeriodRecords(records)
      setShowMenstrualOnboarding(!settings.onboardingCompleted)
    } catch (error) {
      console.error('생리 일정 로드 실패:', error)
      showToast('생리 일정을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsMenstrualLoading(false)
    }
  }

  useEffect(() => {
    loadMenstrualData()
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
      const dates = enumerateDateRange(item.scheduleDate, getScheduleEndDate(item))
      dates.forEach((dateKey) => {
        const arr = map.get(dateKey) || []
        arr.push(item)
        map.set(dateKey, arr)
      })
    })
    return map
  }, [schedules])

  const selectedSchedules = addScheduleDate ? (schedulesByDate.get(addScheduleDate) || []) : []
  const tagColorMap = useMemo(() => {
    const map = new Map()
    tagSettings.forEach((item) => map.set(item.name, item.color))
    return map
  }, [tagSettings])

  const menstrualMarkers = useMemo(() => {
    if (!cycleSettings?.isEnabled) return new Map()
    const visibleRange = getMonthDateRange(year, month, 0)
    return buildMenstrualDateMarkers(
      periodRecords,
      cycleSettings,
      visibleRange.rangeStart,
      visibleRange.rangeEnd,
    )
  }, [periodRecords, cycleSettings, year, month])

  const handleSaveMenstrualToggle = async (nextEnabled) => {
    setIsSavingMenstrualToggle(true)
    try {
      await saveMenstrualFeaturePreference(nextEnabled)
      await loadMenstrualData()
      showToast(
        nextEnabled ? '생리 기능을 사용으로 설정했습니다.' : '생리 기능을 사용 안 함으로 설정했습니다.',
        TOAST_TYPES.SUCCESS,
      )
    } catch (error) {
      showToast(error?.message || '생리 기능 설정 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingMenstrualToggle(false)
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    selectScheduleDate(getTodayDateString())
  }

  /**
   * 일정 추가/조회용 날짜 선택 (메인 달력·date input 공통)
   * @param {string} dateString - YYYY-MM-DD
   */
  const selectScheduleDate = (dateString) => {
    if (!dateString) return
    setAddScheduleDate(dateString)
    setSelectedDate(dateString)
    setAddScheduleEndDate((prev) => (prev < dateString ? dateString : prev))
    setRepeatForm((prev) => {
      if (
        prev.repeatEndType === 'until' &&
        prev.repeatUntil &&
        prev.repeatUntil < dateString
      ) {
        return { ...prev, repeatUntil: dateString }
      }
      return prev
    })
  }

  const formatSchedulePeriod = (schedule) => {
    const end = getScheduleEndDate(schedule)
    if (end === schedule.scheduleDate) {
      return formatSelectedDate(schedule.scheduleDate)
    }
    return `${formatSelectedDate(schedule.scheduleDate)} ~ ${formatSelectedDate(end)}`
  }

  const handleAddSchedule = async () => {
    if (!addScheduleDate) {
      showToast('날짜를 선택해주세요.', TOAST_TYPES.INFO)
      return
    }
    if (!newTitle.trim()) {
      showToast('일정 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const endDate = isRangeSchedule ? addScheduleEndDate : addScheduleDate
    if (endDate < addScheduleDate) {
      showToast('종료일은 시작일보다 빠를 수 없습니다.', TOAST_TYPES.ERROR)
      return
    }
    if (repeatForm.repeatType !== 'none') {
      if (repeatForm.repeatType === 'weekly') {
        const days = repeatForm.repeatWeekdays || []
        if (days.length === 0) {
          showToast('반복할 요일을 선택해주세요.', TOAST_TYPES.ERROR)
          return
        }
      }
      if (repeatForm.repeatEndType === 'until') {
        if (!repeatForm.repeatUntil) {
          showToast('반복 종료일을 선택해주세요.', TOAST_TYPES.ERROR)
          return
        }
        if (repeatForm.repeatUntil < addScheduleDate) {
          showToast('반복 종료일은 시작일보다 빠를 수 없습니다.', TOAST_TYPES.ERROR)
          return
        }
      }
      if (
        repeatForm.repeatEndType === 'count' &&
        (!repeatForm.repeatCount || repeatForm.repeatCount < 1)
      ) {
        showToast('반복 횟수를 입력해주세요.', TOAST_TYPES.ERROR)
        return
      }
    }
    const rangeDays = enumerateDateRange(addScheduleDate, endDate).length
    if (rangeDays > MAX_SCHEDULE_RANGE_DAYS) {
      showToast(`연속 일정은 최대 ${MAX_SCHEDULE_RANGE_DAYS}일까지 등록할 수 있습니다.`, TOAST_TYPES.ERROR)
      return
    }

    setIsSaving(true)
    try {
      await createSchedule({
        scheduleDate: addScheduleDate,
        endDate,
        title: newTitle,
        tag: newTag,
        ...repeatForm,
      })
      setNewTitle('')
      setRepeatForm(buildDefaultRepeatFormState(addScheduleDate))
      selectScheduleDate(addScheduleDate)

      const targetMonth = new Date(`${addScheduleDate}T00:00:00`)
      if (targetMonth.getFullYear() !== year || targetMonth.getMonth() + 1 !== month) {
        setCurrentDate(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1))
      }

      await loadSchedules()
      const isRange = endDate !== addScheduleDate
      const isRepeat = repeatForm.repeatType !== 'none'
      showToast(
        isRepeat
          ? `${describeScheduleRepeat({ ...repeatForm, scheduleDate: addScheduleDate })} 일정이 추가되었습니다.`
          : isRange
            ? '연속 일정이 추가되었습니다.'
            : '일정이 추가되었습니다.',
        TOAST_TYPES.SUCCESS,
      )
    } catch (error) {
      console.error('일정 등록 실패:', error)
      showToast(error?.message || '일정 등록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSchedule = async (schedule) => {
    const isRepeat = (schedule.repeatType || 'none') !== 'none'
    if (
      isRepeat &&
      !window.confirm('반복 일정 전체가 삭제됩니다. 계속할까요?')
    ) {
      return
    }
    setDeletingId(schedule.id)
    try {
      await deleteSchedule(schedule.id)
      await loadSchedules()
      showToast(
        isRepeat ? '반복 일정을 삭제했습니다.' : '일정을 삭제했습니다.',
        TOAST_TYPES.SUCCESS,
      )
    } catch (error) {
      console.error('일정 삭제 실패:', error)
      showToast('일정 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartEditScheduleDate = (schedule) => {
    setEditingScheduleId(schedule.id)
    setEditStartDateDraft(schedule.scheduleDate)
    setEditEndDateDraft(getScheduleEndDate(schedule))
  }

  const handleCancelEditScheduleDate = () => {
    setEditingScheduleId('')
    setEditStartDateDraft('')
    setEditEndDateDraft('')
  }

  const handleUpdateScheduleDate = async (schedule) => {
    if (!editStartDateDraft || !editEndDateDraft) {
      showToast('변경할 날짜를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (editEndDateDraft < editStartDateDraft) {
      showToast('종료일은 시작일보다 빠를 수 없습니다.', TOAST_TYPES.ERROR)
      return
    }

    setUpdatingScheduleId(schedule.id)
    try {
      await updateScheduleDate({
        scheduleId: schedule.id,
        scheduleDate: editStartDateDraft,
        endDate: editEndDateDraft,
      })

      const movedMonth = new Date(`${editStartDateDraft}T00:00:00`)
      setCurrentDate(new Date(movedMonth.getFullYear(), movedMonth.getMonth(), 1))
      selectScheduleDate(addScheduleDate)
      await loadSchedules()
      setEditingScheduleId('')
      setEditStartDateDraft('')
      setEditEndDateDraft('')
      showToast('일정 기간을 변경했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('일정 날짜 변경 실패:', error)
      showToast(error?.message || '일정 기간 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingScheduleId('')
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
    const date = new Date(`${dateString}T00:00:00`)
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`
  }

  const generateCalendarCells = () => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()
    const cells = []

    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square rounded-xl bg-white" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const daySchedules = schedulesByDate.get(dateString) || []
      const isSelected = addScheduleDate === dateString
      const isToday = (() => {
        const now = new Date()
        return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day
      })()
      const menstrualMarker = menstrualMarkers.get(dateString)

      cells.push(
        <button
          key={dateString}
          type="button"
          onClick={() => selectScheduleDate(dateString)}
          className={`aspect-square rounded-xl border p-2 text-left transition-all ${
            isSelected
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : menstrualMarker?.type === MENSTRUAL_MARKER_TYPE.RECORDED
                ? 'border-pink-300 bg-pink-100 hover:border-pink-400'
                : menstrualMarker?.type === MENSTRUAL_MARKER_TYPE.PREDICTED
                  ? 'border-pink-200 border-dashed bg-pink-50 hover:border-pink-300'
                  : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{day}</span>
            <div className="flex items-center gap-1">
              {menstrualMarker && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    menstrualMarker.type === MENSTRUAL_MARKER_TYPE.RECORDED
                      ? 'bg-pink-500'
                      : 'bg-pink-300'
                  }`}
                  title={menstrualMarker.type === MENSTRUAL_MARKER_TYPE.RECORDED ? '생리 기록' : '예상 생리'}
                />
              )}
              {daySchedules.length > 0 && (
                <span className="text-[10px] font-semibold text-blue-600">
                  {daySchedules.length}개
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {daySchedules.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className={`truncate rounded border px-1.5 py-0.5 text-[11px] ${tagColorMap.get(item.tag) || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                title={isMultiDaySchedule(item) ? `${item.title} (${formatSchedulePeriod(item)})` : item.title}
              >
                {item.title}
                {isMultiDaySchedule(item) && (
                  <span className="ml-1 text-[10px] opacity-75">연속</span>
                )}
              </div>
            ))}
          </div>
        </button>,
      )
    }

    return cells
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 self-start">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {year}년 {month}월
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrevMonth} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">←</button>
            <button type="button" onClick={handleToday} className="px-3 py-1.5 rounded-lg border border-blue-300 text-sm text-blue-700 hover:bg-blue-50">오늘</button>
            <button type="button" onClick={handleNextMonth} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">→</button>
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
          <>
            {cycleSettings?.isEnabled && (
              <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-pink-200 border border-pink-300" />
                  생리 기록
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-pink-50 border border-dashed border-pink-300" />
                  예상 생리
                </span>
              </div>
            )}
            <div className="grid grid-cols-7 gap-2">
              {generateCalendarCells()}
            </div>
          </>
        )}
      </section>

      <aside className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 self-start">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800">일정 추가</h3>
          <button
            type="button"
            onClick={() => setShowTagSettings(true)}
            className="text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 px-2 py-1 hover:bg-gray-50"
            title="태그 설정"
          >
            ⚙️
          </button>
        </div>
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={addScheduleDate}
              onChange={(e) => selectScheduleDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => selectScheduleDate(getTodayDateString())}
              className="shrink-0 px-3 py-2 rounded-lg border border-blue-300 text-sm text-blue-700 hover:bg-blue-50"
            >
              오늘
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">{formatSelectedDate(addScheduleDate)}</p>
          <label className="mt-3 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRangeSchedule}
              onChange={(e) => {
                const checked = e.target.checked
                setIsRangeSchedule(checked)
                if (checked && addScheduleEndDate < addScheduleDate) {
                  setAddScheduleEndDate(addScheduleDate)
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-700">연속 일정 (기간)</span>
          </label>
          {isRangeSchedule && (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">종료일</label>
              <input
                type="date"
                value={addScheduleEndDate}
                min={addScheduleDate}
                onChange={(e) => setAddScheduleEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                {formatSelectedDate(addScheduleEndDate)}
                {addScheduleEndDate >= addScheduleDate && (
                  <span className="ml-1 text-blue-600">
                    · {enumerateDateRange(addScheduleDate, addScheduleEndDate).length}일
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">최대 {MAX_SCHEDULE_RANGE_DAYS}일</p>
            </div>
          )}
          <ScheduleRepeatEditor
            value={repeatForm}
            onChange={setRepeatForm}
            startDate={addScheduleDate}
            onStartDateChange={(ymd) => {
              selectScheduleDate(ymd)
              setRepeatForm((prev) => {
                if (
                  prev.repeatEndType === 'until' &&
                  prev.repeatUntil &&
                  prev.repeatUntil < ymd
                ) {
                  return { ...prev, repeatUntil: ymd }
                }
                return prev
              })
            }}
            formatDate={formatSelectedDate}
          />
        </div>

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
            disabled={isSaving || !addScheduleDate}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '추가 중...' : '일정 추가'}
          </button>
        </div>

        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          {formatSelectedDate(addScheduleDate)} 일정
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {addScheduleDate && selectedSchedules.length === 0 && (
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
                  {isMultiDaySchedule(item) && (
                    <p className="text-xs text-gray-500 mt-1">{formatSchedulePeriod(item)}</p>
                  )}
                  {(item.repeatType || 'none') !== 'none' && (
                    <p className="text-xs text-indigo-600 mt-1">
                      {describeScheduleRepeat(item)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSchedule(item)}
                  disabled={deletingId === item.id}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === item.id ? '삭제 중' : '삭제'}
                </button>
              </div>
              {editingScheduleId === item.id ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8 shrink-0">시작</span>
                    <input
                      type="date"
                      value={editStartDateDraft}
                      onChange={(e) => {
                        const nextStart = e.target.value
                        setEditStartDateDraft(nextStart)
                        if (editEndDateDraft < nextStart) {
                          setEditEndDateDraft(nextStart)
                        }
                      }}
                      className="flex-1 px-2 py-1.5 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8 shrink-0">종료</span>
                    <input
                      type="date"
                      value={editEndDateDraft}
                      min={editStartDateDraft}
                      onChange={(e) => setEditEndDateDraft(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateScheduleDate(item)}
                      disabled={updatingScheduleId === item.id}
                      className="text-xs px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updatingScheduleId === item.id ? '저장 중' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditScheduleDate}
                      disabled={updatingScheduleId === item.id}
                      className="text-xs px-2 py-1.5 rounded border border-gray-300 text-gray-600 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (item.repeatType || 'none') === 'none' ? (
                <button
                  type="button"
                  onClick={() => handleStartEditScheduleDate(item)}
                  className="mt-3 text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  기간 변경
                </button>
              ) : (
                <p className="mt-2 text-xs text-gray-400">반복 일정 삭제는 시리즈 전체에 적용됩니다.</p>
              )}
            </div>
          ))}
        </div>

        {cycleSettings?.isEnabled ? (
          <MenstrualCyclePanel
            selectedDate={addScheduleDate}
            periodRecords={periodRecords}
            cycleSettings={cycleSettings}
            onChanged={loadMenstrualData}
            formatSelectedDate={formatSelectedDate}
          />
        ) : (
          <section className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-1">생리 일정</h3>
            <p className="text-xs text-gray-500">
              일정 달력 설정에서 생리 기능을 켜면 생리 일정 기록/예상 표시를 사용할 수 있어요.
            </p>
          </section>
        )}
        {isMenstrualLoading && (
          <p className="mt-2 text-xs text-gray-400">생리 일정 불러오는 중...</p>
        )}
      </aside>

      {showTagSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-800">일정 달력 설정</h4>
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
            <div className="mb-4 rounded-lg border border-pink-200 bg-pink-50/60 p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-700">생리 기능 사용</span>
                <input
                  type="checkbox"
                  checked={Boolean(cycleSettings?.isEnabled)}
                  onChange={(e) => handleSaveMenstrualToggle(e.target.checked)}
                  disabled={isSavingMenstrualToggle}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-400"
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">
                켜면 일정 달력에 생리 기록/예상일이 표시됩니다.
              </p>
            </div>
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

      {showMenstrualOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-5">
            <h4 className="text-lg font-bold text-gray-800 mb-2">생리 기능 사용 설정</h4>
            <p className="text-sm text-gray-600 mb-4">
              일정 달력에서 생리 일정(기록/예상일)을 함께 관리할까요?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSaveMenstrualToggle(false)}
                disabled={isSavingMenstrualToggle}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                사용 안 함
              </button>
              <button
                type="button"
                onClick={() => handleSaveMenstrualToggle(true)}
                disabled={isSavingMenstrualToggle}
                className="px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 disabled:opacity-50"
              >
                사용할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
