/**
 * 포실이 여행 — 10단계 이후 코스를 골라 떠나고, 기록으로 받은 젤리만큼 이동한다
 */
import { useCallback, useEffect, useState } from 'react'
import {
  claimFarmTripReward,
  getMyFarmTrip,
  markFarmPostcardsSeen,
  startFarmTrip,
} from '../../services/farmService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 엽서 이미지가 없으면 경유지 이모지로 표시한다
 * @param {Object} props
 * @param {Object} props.stop
 * @param {string} [props.className]
 */
function PostcardArt({ stop, className = '' }) {
  if (stop.imageUrl) {
    return <img src={stop.imageUrl} alt={stop.name} className={`object-cover ${className}`} />
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-sky-100 to-amber-100 text-5xl ${className}`}
    >
      {stop.emoji}
    </div>
  )
}

/**
 * 코스별 엽서 도감
 * @param {Object} props
 * @param {Array} props.courses
 */
function FarmPostcardAlbum({ courses }) {
  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <div key={course.courseKey}>
          <h4 className="mb-2 text-sm font-bold text-gray-700">
            {course.emoji} {course.title}
            {course.clearCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                🏅 완주 {course.clearCount}회
              </span>
            )}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {course.stops.map((stop) => (
              <div key={stop.id} className="overflow-hidden rounded-xl border border-sky-100 bg-white">
                {stop.collected ? (
                  <PostcardArt stop={stop} className="h-20 w-full" />
                ) : (
                  <div className="flex h-20 items-center justify-center bg-gray-100 text-2xl text-gray-400">
                    ?
                  </div>
                )}
                <p className="truncate px-1 py-1 text-center text-xs text-gray-600">
                  {stop.collected ? stop.name : `${stop.kmAt}km`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {number | null} props.jellyBalance
 */
export default function FarmTripPanel({ jellyBalance }) {
  const [trip, setTrip] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAlbum, setShowAlbum] = useState(false)
  const [postcards, setPostcards] = useState([])

  const load = useCallback(async () => {
    const data = await getMyFarmTrip()
    setTrip(data)
    if (data?.unseenPostcards?.length) {
      setPostcards(data.unseenPostcards)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!trip) return null

  const { activeTrip, courses, startJellyCost, dailyKmCap } = trip
  const activeCourse = activeTrip
    ? courses.find((course) => course.courseKey === activeTrip.courseKey)
    : null

  const handleStart = async (course) => {
    if ((jellyBalance ?? 0) < startJellyCost) {
      showToast(`도시락에는 젤리 ${startJellyCost}개가 필요해요.`, TOAST_TYPES.ERROR)
      return
    }
    if (!window.confirm(`젤리 ${startJellyCost}개로 도시락을 싸서 ${course.title}로 떠날까요?`)) {
      return
    }
    setIsSubmitting(true)
    try {
      await startFarmTrip(course.courseKey)
      showToast(`포실이가 ${course.title}로 출발했어요! 🎒`, TOAST_TYPES.SUCCESS)
      await load()
    } catch (error) {
      showToast(error?.message || '여행을 시작하지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClaim = async () => {
    setIsSubmitting(true)
    try {
      const result = await claimFarmTripReward()
      showToast(
        result?.firstClear
          ? `${result.courseTitle} 첫 완주! 배지와 씨앗 ${result.seedGranted}개를 받았어요 🏅`
          : `${result?.courseTitle} 여행을 마쳤어요. 다음 코스를 골라 보세요!`,
        TOAST_TYPES.SUCCESS,
      )
      await load()
    } catch (error) {
      showToast(error?.message || '보상을 받지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClosePostcards = async () => {
    setPostcards([])
    await markFarmPostcardsSeen()
  }

  const progressPercent = activeCourse
    ? Math.min(100, Math.round((activeTrip.distanceKm / activeCourse.totalKm) * 100))
    : 0
  const nextStop = activeCourse?.stops.find((stop) => stop.kmAt > activeTrip.distanceKm)

  return (
    <section className="rounded-2xl bg-white border-2 border-sky-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>🎒</span> 포실이 여행
        </h2>
        <button
          type="button"
          onClick={() => setShowAlbum((prev) => !prev)}
          className="shrink-0 rounded-full border border-sky-200 px-3 py-1 text-sm font-semibold text-sky-700 hover:bg-sky-50"
        >
          {showAlbum ? '여행 보기' : '엽서 도감'}
        </button>
      </div>

      {showAlbum ? (
        <FarmPostcardAlbum courses={courses} />
      ) : activeCourse ? (
        <div className="space-y-3">
          <p className="font-semibold text-gray-700">
            {activeCourse.emoji} {activeCourse.title}
          </p>
          <div>
            <div className="flex justify-between text-xs text-sky-700 mb-1">
              <span>
                {activeTrip.status === 'arrived'
                  ? '도착했어요!'
                  : nextStop
                    ? `다음 경유지: ${nextStop.name} (${nextStop.kmAt}km)`
                    : ''}
              </span>
              <span className="font-bold">
                {activeTrip.distanceKm} / {activeCourse.totalKm}km
              </span>
            </div>
            <div className="h-3 bg-sky-50 rounded-full overflow-hidden border border-sky-200">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          {activeTrip.status === 'arrived' ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 text-white font-bold shadow-md disabled:opacity-50"
            >
              완주 보상 받기
            </button>
          ) : (
            <p className="text-sm text-gray-600">
              오늘 {activeTrip.todayKm} / {dailyKmCap}km 이동했어요 · {activeCourse.bonusLabel}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            기록으로 받은 젤리 1개가 1km가 돼요. 하루 최대 {dailyKmCap}km까지 이동해요.
          </p>
          {courses.map((course) => (
            <button
              key={course.courseKey}
              type="button"
              onClick={() => handleStart(course)}
              disabled={isSubmitting}
              className="w-full rounded-xl border-2 border-sky-100 p-3 text-left hover:bg-sky-50 disabled:opacity-50"
            >
              <span className="block font-bold text-gray-800">
                {course.emoji} {course.title} · {course.totalKm}km
                {course.clearCount > 0 && ' 🏅'}
              </span>
              <span className="block text-sm text-gray-600">{course.description}</span>
              <span className="block mt-1 text-xs font-semibold text-sky-700">
                {course.bonusLabel} · 도시락 젤리 {startJellyCost}개
              </span>
            </button>
          ))}
        </div>
      )}

      {postcards.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border-2 border-sky-200 animate-gacha-pop">
            <h3 className="text-xl font-bold text-sky-800 mb-3">
              엽서가 도착했어요! 💌
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {postcards.map((stop) => (
                <div key={stop.id} className="overflow-hidden rounded-2xl border border-sky-100">
                  <PostcardArt stop={stop} className="h-32 w-full" />
                  <p className="pt-2 font-bold text-gray-800">{stop.name}</p>
                  <p className="px-3 pb-3 text-sm text-gray-600">{stop.message}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClosePostcards}
              className="mt-4 px-8 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
