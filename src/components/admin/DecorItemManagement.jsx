import { useEffect, useRef, useState } from 'react'
import { GACHA_GRADES, getGachaGradeMeta } from '../../constants/gachaGrades.js'
import { FARM_DEFAULT_IMAGES } from '../../constants/farm.js'
import {
  DECOR_IMAGE_FOLDER,
  DECOR_SLOT_MAP,
  DECOR_SLOT_OPTIONS,
  DECOR_SLOTS,
} from '../../constants/posiliDecor.js'
import {
  createDecorItem,
  deleteDecorItem,
  getAllDecorItems,
  updateDecorItem,
} from '../../services/posiliDecorService.js'
import { uploadImage } from '../../services/imageService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import PosiliAvatar from '../posili/PosiliAvatar.jsx'

const EMPTY_FORM = {
  slot: DECOR_SLOTS.BACKGROUND,
  name: '',
  description: '',
  rarity: 'common',
  priceJelly: 30,
  sortOrder: 0,
  isActive: true,
  imageUrl: '',
}

/**
 * 관리자: 포실이 꾸미기 아이템 등록·관리
 */
export default function DecorItemManagement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [inlineSavingId, setInlineSavingId] = useState(null)
  const fileInputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await getAllDecorItems())
    } catch {
      showToast('꾸미기 아이템을 불러오지 못했습니다. SQL(supabase-posili-decor.sql) 실행 여부를 확인해주세요.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // 액자는 투명 PNG가 JPEG(흰 배경)로 바뀌면 안 되므로 압축하지 않는다
      const url = await uploadImage(file, DECOR_IMAGE_FOLDER, { skipCompress: true })
      setForm((prev) => ({ ...prev, imageUrl: url }))
      showToast('이미지가 업로드되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '이미지 업로드에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm({
      slot: item.slot,
      name: item.name,
      description: item.description,
      rarity: item.rarity,
      priceJelly: item.priceJelly,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      imageUrl: item.imageUrl,
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!form.imageUrl) {
      showToast('이미지를 업로드해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        await updateDecorItem(editingId, form)
        showToast('아이템이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createDecorItem(form)
        showToast('아이템이 등록되었습니다.', TOAST_TYPES.SUCCESS)
      }
      setShowForm(false)
      load()
    } catch (error) {
      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (item) => {
    const prevItems = items
    setItems((list) => list.map((row) => (row.id === item.id ? { ...row, isActive: !item.isActive } : row)))
    setInlineSavingId(item.id)
    try {
      await updateDecorItem(item.id, { isActive: !item.isActive })
    } catch (error) {
      setItems(prevItems)
      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setInlineSavingId(null)
    }
  }

  const handleDelete = async (item) => {
    const message =
      `"${item.name}"을(를) 삭제할까요?\n` +
      '이미 산 사용자의 보유·착용 기록도 함께 사라지고 되돌릴 수 없어요.\n' +
      '판매만 멈추려면 "판매 중" 체크를 해제하세요.'
    if (!confirm(message)) return

    try {
      await deleteDecorItem(item.id)
      showToast('삭제되었습니다.', TOAST_TYPES.SUCCESS)
      load()
    } catch (error) {
      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500 font-sans">로딩 중...</div>
  }

  const formSlotMeta = DECOR_SLOT_MAP[form.slot]

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          배경·액자 아이템을 등록하면 포실이 성장 화면의 꾸미기에서 젤리로 살 수 있어요. 판매를 멈춰도 이미 산 사람은 계속 쓸 수 있어요.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600"
        >
          + 아이템 등록
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl border-2 border-pink-200 bg-pink-50/50 p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-800">{editingId ? '아이템 수정' : '아이템 등록'}</h3>

          <div className="grid gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-700">부위 *</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DECOR_SLOT_OPTIONS.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, slot: slot.id }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        form.slot === slot.id
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {slot.icon} {slot.label}
                    </button>
                  ))}
                </div>
                {formSlotMeta && <p className="mt-1 text-xs text-gray-500">{formSlotMeta.uploadHint}</p>}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">이름 *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="예: 겨울 눈꽃 배경"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">설명</span>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="예: 12월 한정"
                />
              </label>

              <div>
                <span className="text-sm font-medium text-gray-700">등급</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {GACHA_GRADES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, rarity: g.id }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        form.rarity === g.id
                          ? `${g.colorClass} ring-2 ring-offset-1 ${g.ringClass}`
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">젤리 가격 (0 = 무료)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.priceJelly}
                    onChange={(e) => setForm((p) => ({ ...p, priceJelly: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">정렬 순서</span>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">판매 중</span>
              </label>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
                >
                  {isUploading ? '업로드 중…' : form.imageUrl ? '이미지 바꾸기' : '이미지 업로드 *'}
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-gray-700">미리보기</span>
              <div className="rounded-2xl bg-gradient-to-b from-sky-100 via-green-50 to-amber-50 p-4">
                <PosiliAvatar
                  characterImageUrl={FARM_DEFAULT_IMAGES[2]}
                  previewOverride={{ [form.slot]: form.imageUrl || null }}
                  sizeClassName="w-40 h-40"
                />
              </div>
              <p className="max-w-[12rem] text-center text-xs text-gray-500">기본 포실이에 입혀 본 모습이에요.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 disabled:opacity-50"
            >
              {isSaving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-gray-500">등록된 꾸미기 아이템이 없어요.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">이미지</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">부위</th>
                <th className="px-3 py-2">등급</th>
                <th className="px-3 py-2">젤리</th>
                <th className="px-3 py-2">순서</th>
                <th className="px-3 py-2">판매 중</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const grade = getGachaGradeMeta(item.rarity)
                const slotMeta = DECOR_SLOT_MAP[item.slot]
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-lg bg-gray-50 object-cover" />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {slotMeta ? `${slotMeta.icon} ${slotMeta.label}` : item.slot}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${grade.colorClass}`}>
                        {grade.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.priceJelly > 0 ? item.priceJelly : '무료'}</td>
                    <td className="px-3 py-2 tabular-nums">{item.sortOrder}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        disabled={inlineSavingId === item.id}
                        onChange={() => handleToggleActive(item)}
                        aria-label={`${item.name} 판매 여부`}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="mr-2 text-blue-600 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
