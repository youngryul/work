import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCountryName } from '../../constants/countries.js'
import { getTravelAbroadMeta } from '../../constants/travelAbroad.js'
import { useCountryExchangeRate } from '../../hooks/useCountryExchangeRate.js'
import { useLocalDateTime } from '../../hooks/useLocalDateTime.js'
import {
  buildTripDateKeys,
  createAbroadItineraryItem,
  deleteAbroadItineraryItem,
  getAbroadItineraryItems,
  toDateKey,
  updateAbroadItineraryItem,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import TravelItineraryItemForm from './TravelItineraryItemForm.jsx'
import TravelItineraryTimeline from './TravelItineraryTimeline.jsx'

/**
 * @param {{ trip: object, onBack: () => void }} props
 */
export default function TravelItineraryDetail({ trip, onBack }) {
  const meta = getTravelAbroadMeta(trip.countryCode)
  const { dateLabel, timeLabel } = useLocalDateTime(meta.timeZone)
  const {
    ratePerUnit,
    unitLabel,
    currencyLabel,
    isLoading: rateLoading,
    error: rateError,
  } = useCountryExchangeRate(trip.countryCode)

  const dateKeys = useMemo(
    () => buildTripDateKeys(trip.departureAt, trip.returnAt),
    [trip.departureAt, trip.returnAt],
  )

  const [selectedDate, setSelectedDate] = useState(() => dateKeys[0] || toDateKey(trip.departureAt))
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [draftStart, setDraftStart] = useState(540)
  const [draftEnd, setDraftEnd] = useState(570)

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAbroadItineraryItems(trip.id, selectedDate)
      setItems(data)
    } catch (error) {
      showToast(error?.message || '일정을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [trip.id, selectedDate])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const formatTripRange = () => {
    const start = new Date(trip.departureAt)
    const end = new Date(trip.returnAt)
    const fmt = (d) =>
      d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    return `${fmt(start)} → ${fmt(end)}`
  }

  const formatRate = () => {
    if (rateLoading) return '환율 불러오는 중...'
    if (rateError || ratePerUnit == null) return rateError || '환율 정보 없음'
    const formatted = ratePerUnit.toLocaleString('ko-KR', {
      maximumFractionDigits: ratePerUnit >= 100 ? 2 : 4,
    })
    return `1 ${unitLabel || currencyLabel} = ${formatted}원`
  }

  const openCreate = (startMinute) => {
    setEditingItem(null)
    setDraftStart(startMinute)
    setDraftEnd(Math.min(1440, startMinute + 30))
    setFormOpen(true)
  }

  const handleSubmit = async (payload) => {
    try {
      if (editingItem) {
        await updateAbroadItineraryItem(editingItem.id, {
          ...payload,
          tripDepartureAt: trip.departureAt,
          tripReturnAt: trip.returnAt,
        })
        showToast('일정을 수정했습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createAbroadItineraryItem({
          tripId: trip.id,
          ...payload,
          tripDepartureAt: trip.departureAt,
          tripReturnAt: trip.returnAt,
        })
        showToast('일정을 추가했습니다.', TOAST_TYPES.SUCCESS)
      }
      setFormOpen(false)
      setEditingItem(null)
      if (payload.itemDate !== selectedDate) {
        setSelectedDate(payload.itemDate)
      } else {
        await loadItems()
      }
    } catch (error) {
      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
      throw error
    }
  }

  const handleDelete = async () => {
    if (!editingItem) return
    try {
      await deleteAbroadItineraryItem(editingItem.id)
      showToast('일정을 삭제했습니다.', TOAST_TYPES.SUCCESS)
      setFormOpen(false)
      setEditingItem(null)
      await loadItems()
    } catch (error) {
      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
      throw error
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 font-sans">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm text-sky-600 hover:text-sky-800"
      >
        ← 목록으로
      </button>

      <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sky-700 mb-1">
              {getCountryName(trip.countryCode)} · {meta.timeZone}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{trip.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{formatTripRange()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{dateLabel}</p>
            <p className="text-3xl font-bold text-sky-800 font-mono tracking-tight">{timeLabel}</p>
            <p className="text-sm font-semibold text-amber-700 mt-2">{formatRate()}</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
        {dateKeys.map((dateKey, index) => {
          const d = new Date(`${dateKey}T00:00:00`)
          const label = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
          const selected = dateKey === selectedDate
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={`shrink-0 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                selected
                  ? 'bg-sky-500 text-white border-sky-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-sky-300'
              }`}
            >
              Day {index + 1}
              <span className="block text-[11px] opacity-80">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">
          {selectedDate} 일정
          <span className="ml-2 text-sm font-normal text-gray-500">{items.length}건</span>
        </h2>
        <button
          type="button"
          onClick={() => openCreate(540)}
          className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600"
        >
          + 일정 추가
        </button>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-10">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-gray-500 mb-3">이 날짜에 등록된 일정이 없습니다</p>
          <button
            type="button"
            onClick={() => openCreate(540)}
            className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600"
          >
            + 첫 일정 추가
          </button>
        </div>
      ) : (
        <TravelItineraryTimeline
          items={items}
          onEdit={(item) => {
            setEditingItem(item)
            setFormOpen(true)
          }}
        />
      )}

      <TravelItineraryItemForm
        isOpen={formOpen}
        initialDate={selectedDate}
        initialStartMinute={draftStart}
        initialEndMinute={draftEnd}
        editingItem={editingItem}
        onClose={() => {
          setFormOpen(false)
          setEditingItem(null)
        }}
        onSubmit={handleSubmit}
        onDelete={editingItem ? handleDelete : undefined}
      />
    </div>
  )
}
