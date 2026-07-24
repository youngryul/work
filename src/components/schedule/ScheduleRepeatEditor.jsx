import {
  SCHEDULE_MONTHLY_RULES,
  SCHEDULE_NTH_OPTIONS,
  SCHEDULE_REPEAT_END_TYPES,
  SCHEDULE_REPEAT_TYPES,
  SCHEDULE_WEEKDAYS,
  describeScheduleRepeat,
  getScheduleRepeatLabel,
} from '../../utils/scheduleRepeat.js'

/**
 * 일정 반복 옵션 편집터
 * @param {{
 *   value: object,
 *   onChange: (next: object) => void,
 *   startDate: string,
 *   onStartDateChange?: (ymd: string) => void,
 *   formatDate?: (ymd: string) => string,
 * }} props
 */
export default function ScheduleRepeatEditor({
  value,
  onChange,
  startDate,
  onStartDateChange,
  formatDate,
}) {
  const patch = (partial) => onChange({ ...value, ...partial })
  const repeatType = value.repeatType || 'none'

  const toggleWeekday = (dayId) => {
    const current = Array.isArray(value.repeatWeekdays) ? value.repeatWeekdays : []
    const next = current.includes(dayId)
      ? current.filter((d) => d !== dayId)
      : [...current, dayId].sort((a, b) => a - b)
    patch({ repeatWeekdays: next.length > 0 ? next : [dayId] })
  }

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">반복</label>
        <select
          value={repeatType}
          onChange={(e) => patch({ repeatType: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {SCHEDULE_REPEAT_TYPES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {repeatType !== 'none' && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-3">
          {/* 주기 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 shrink-0">반복 주기</label>
            <input
              type="number"
              min={1}
              max={52}
              value={value.repeatInterval || 1}
              onChange={(e) =>
                patch({ repeatInterval: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-16 px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-center"
            />
            <span className="text-sm text-gray-700">
              {repeatType === 'weekly' ? '주마다' : repeatType === 'monthly' ? '개월마다' : '년마다'}
            </span>
          </div>

          {/* 주: 요일 */}
          {repeatType === 'weekly' && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">반복 요일</p>
              <div className="flex flex-wrap gap-1.5">
                {SCHEDULE_WEEKDAYS.map((day) => {
                  const active = (value.repeatWeekdays || []).includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleWeekday(day.id)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold border transition ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 월: 규칙 */}
          {repeatType === 'monthly' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">반복 방식</p>
              <div className="space-y-1.5">
                {SCHEDULE_MONTHLY_RULES.map((rule) => (
                  <label
                    key={rule.id}
                    className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="monthly-rule"
                      checked={(value.repeatMonthlyRule || 'day') === rule.id}
                      onChange={() => patch({ repeatMonthlyRule: rule.id })}
                      className="mt-1 text-indigo-600"
                    />
                    <span className="flex-1">
                      {rule.id === 'day' && (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          매월
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={value.repeatMonthDay || 1}
                            onChange={(e) =>
                              patch({
                                repeatMonthlyRule: 'day',
                                repeatMonthDay: Math.min(
                                  31,
                                  Math.max(1, Number(e.target.value) || 1),
                                ),
                              })
                            }
                            className="w-14 px-1.5 py-0.5 rounded border border-gray-300 text-sm"
                          />
                          일
                        </span>
                      )}
                      {rule.id === 'nth_weekday' && (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          매월
                          <select
                            value={value.repeatNth || 1}
                            onChange={(e) =>
                              patch({
                                repeatMonthlyRule: 'nth_weekday',
                                repeatNth: Number(e.target.value),
                              })
                            }
                            className="px-1.5 py-0.5 rounded border border-gray-300 text-sm bg-white"
                          >
                            {SCHEDULE_NTH_OPTIONS.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={
                              Number.isFinite(Number(value.repeatWeekday))
                                ? value.repeatWeekday
                                : 1
                            }
                            onChange={(e) =>
                              patch({
                                repeatMonthlyRule: 'nth_weekday',
                                repeatWeekday: Number(e.target.value),
                              })
                            }
                            className="px-1.5 py-0.5 rounded border border-gray-300 text-sm bg-white"
                          >
                            {SCHEDULE_WEEKDAYS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.label}요일
                              </option>
                            ))}
                          </select>
                        </span>
                      )}
                      {rule.id === 'last_weekday' && (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          매월 마지막
                          <select
                            value={
                              Number.isFinite(Number(value.repeatWeekday))
                                ? value.repeatWeekday
                                : 1
                            }
                            onChange={(e) =>
                              patch({
                                repeatMonthlyRule: 'last_weekday',
                                repeatWeekday: Number(e.target.value),
                              })
                            }
                            className="px-1.5 py-0.5 rounded border border-gray-300 text-sm bg-white"
                          >
                            {SCHEDULE_WEEKDAYS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.label}요일
                              </option>
                            ))}
                          </select>
                        </span>
                      )}
                      {rule.id === 'last_day' && '매월 말일'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 년 */}
          {repeatType === 'yearly' && startDate && (
            <p className="text-sm text-gray-700">
              반복일:{' '}
              <span className="font-semibold text-indigo-800">
                매년{' '}
                {formatDate
                  ? formatDate(startDate).replace(/\s*\([^)]*\)\s*$/, '')
                  : startDate}
              </span>
            </p>
          )}

          {/* 시작일 */}
          {onStartDateChange && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 종료 */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">종료</p>
            <div className="space-y-2">
              {SCHEDULE_REPEAT_END_TYPES.map((end) => (
                <label
                  key={end.id}
                  className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="repeat-end"
                    checked={(value.repeatEndType || 'until') === end.id}
                    onChange={() => patch({ repeatEndType: end.id })}
                    className="text-indigo-600"
                  />
                  <span>{end.label}</span>
                  {end.id === 'count' && (value.repeatEndType || 'until') === 'count' && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={value.repeatCount || 10}
                        onChange={(e) =>
                          patch({
                            repeatEndType: 'count',
                            repeatCount: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-16 px-1.5 py-0.5 rounded border border-gray-300 text-sm"
                      />
                      <span>회 반복</span>
                    </>
                  )}
                  {end.id === 'until' && (value.repeatEndType || 'until') === 'until' && (
                    <>
                      <input
                        type="date"
                        value={value.repeatUntil || ''}
                        min={startDate}
                        onChange={(e) =>
                          patch({ repeatEndType: 'until', repeatUntil: e.target.value })
                        }
                        className="px-1.5 py-0.5 rounded border border-gray-300 text-sm"
                      />
                      <span>까지</span>
                    </>
                  )}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs font-medium text-indigo-800">
            {describeScheduleRepeat({
              ...value,
              scheduleDate: startDate,
              seriesStartDate: startDate,
            }) || getScheduleRepeatLabel(repeatType)}
          </p>
        </div>
      )}
    </div>
  )
}
