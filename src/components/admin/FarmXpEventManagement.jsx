import { useEffect, useState } from 'react'
import {
  createFarmXpEvent,
  deleteFarmXpEvent,
  getAllFarmSettings,
  getAllFarmXpEvents,
  updateFarmSetting,
  updateFarmXpEvent,
} from '../../services/farmXpEventService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const EMPTY_FORM = {
  eventKey: '',
  label: '',
  description: '',
  xpAmount: 5,
  jellyCost: 0,
  minStage: 2,
  maxStage: '',
  triggerType: 'auto',
  farmArea: '',
  isActive: true,
  sortOrder: 0,
}

/**
 * 관리자: 농장 경험치 이벤트·설정 관리
 */
export default function FarmXpEventManagement() {
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [settingEdits, setSettingEdits] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const [eventData, settingData] = await Promise.all([
        getAllFarmXpEvents(),
        getAllFarmSettings(),
      ])
      setEvents(eventData)
      setSettings(settingData)
      setSettingEdits(Object.fromEntries(settingData.map((s) => [s.key, s.value])))
    } catch {
      showToast('농장 설정을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleEdit = (event) => {
    setEditingId(event.id)
    setForm({
      eventKey: event.eventKey,
      label: event.label,
      description: event.description || '',
      xpAmount: event.xpAmount,
      jellyCost: event.jellyCost,
      minStage: event.minStage,
      maxStage: event.maxStage ?? '',
      triggerType: event.triggerType,
      farmArea: event.farmArea || '',
      isActive: event.isActive,
      sortOrder: event.sortOrder,
    })
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 이벤트를 삭제할까요?')) return
    try {
      await deleteFarmXpEvent(id)
      showToast('삭제되었습니다.', TOAST_TYPES.SUCCESS)
      load()
    } catch (error) {
      showToast(error?.message || '삭제 실패', TOAST_TYPES.ERROR)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...form,
        xpAmount: Number(form.xpAmount),
        jellyCost: Number(form.jellyCost),
        minStage: Number(form.minStage),
        maxStage: form.maxStage === '' ? null : Number(form.maxStage),
        sortOrder: Number(form.sortOrder),
      }
      if (editingId) {
        await updateFarmXpEvent(editingId, payload)
        showToast('수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createFarmXpEvent(payload)
        showToast('등록되었습니다.', TOAST_TYPES.SUCCESS)
      }
      setShowForm(false)
      load()
    } catch (error) {
      showToast(error?.message || '저장 실패', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      await Promise.all(
        settings.map((s) => updateFarmSetting(s.key, settingEdits[s.key] ?? s.value)),
      )
      showToast('농장 설정이 저장되었습니다.', TOAST_TYPES.SUCCESS)
      load()
    } catch (error) {
      showToast(error?.message || '설정 저장 실패', TOAST_TYPES.ERROR)
    }
  }

  if (loading) {
    return <p className="text-gray-500">불러오는 중…</p>
  }

  return (
    <div className="space-y-8">
      {/* 전역 설정 */}
      <section className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">농장 전역 설정</h2>
        <div className="space-y-3 max-w-md">
          {settings.map((setting) => (
            <div key={setting.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {setting.label}
                <span className="text-gray-400 font-normal ml-2">({setting.key})</span>
              </label>
              <input
                type="text"
                value={settingEdits[setting.key] ?? ''}
                onChange={(e) =>
                  setSettingEdits((prev) => ({ ...prev, [setting.key]: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
        >
          설정 저장
        </button>
      </section>

      {/* 이벤트 목록 */}
      <section className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">경험치 이벤트</h2>
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
          >
            + 이벤트 추가
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">이벤트 키</label>
                <input
                  type="text"
                  value={form.eventKey}
                  onChange={(e) => setForm({ ...form, eventKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  disabled={Boolean(editingId)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">표시 이름</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">설명</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">경험치</label>
                <input
                  type="number"
                  min="0"
                  value={form.xpAmount}
                  onChange={(e) => setForm({ ...form, xpAmount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">젤리 비용</label>
                <input
                  type="number"
                  min="0"
                  value={form.jellyCost}
                  onChange={(e) => setForm({ ...form, jellyCost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">최소 단계</label>
                <input
                  type="number"
                  min="1"
                  value={form.minStage}
                  onChange={(e) => setForm({ ...form, minStage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">최대 단계 (비우면 제한 없음)</label>
                <input
                  type="number"
                  min="1"
                  value={form.maxStage}
                  onChange={(e) => setForm({ ...form, maxStage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">트리거</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="auto">자동 (활동 연동)</option>
                  <option value="manual">수동 (버튼 클릭)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">농장 영역</label>
                <input
                  type="text"
                  value={form.farmArea}
                  onChange={(e) => setForm({ ...form, farmArea: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 운동 밭"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">정렬</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="farm-event-active"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label htmlFor="farm-event-active" className="text-sm font-medium text-gray-700">
                  활성
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {isSaving ? '저장 중…' : editingId ? '수정' : '등록'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
              >
                취소
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-2 pr-2">키</th>
                <th className="py-2 pr-2">이름</th>
                <th className="py-2 pr-2">XP</th>
                <th className="py-2 pr-2">젤리</th>
                <th className="py-2 pr-2">단계</th>
                <th className="py-2 pr-2">유형</th>
                <th className="py-2 pr-2">활성</th>
                <th className="py-2">관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2 font-mono text-xs">{event.eventKey}</td>
                  <td className="py-2 pr-2">{event.label}</td>
                  <td className="py-2 pr-2">+{event.xpAmount}</td>
                  <td className="py-2 pr-2">{event.jellyCost || '—'}</td>
                  <td className="py-2 pr-2">
                    {event.minStage}
                    {event.maxStage ? `~${event.maxStage}` : '+'}
                  </td>
                  <td className="py-2 pr-2">{event.triggerType}</td>
                  <td className="py-2 pr-2">{event.isActive ? '✅' : '—'}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(event)}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event.id)}
                      className="text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
