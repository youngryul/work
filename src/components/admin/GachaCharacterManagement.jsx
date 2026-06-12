import { useEffect, useRef, useState } from 'react'

import {

  GACHA_GRADES,

  GACHA_GRADE_DEFAULT_DROP_WEIGHT,

  getGachaGradeMeta,

} from '../../constants/gachaGrades.js'

import {

  createGachaCharacter,

  deleteGachaCharacter,

  getAllGachaCharacters,

  updateGachaCharacter,

} from '../../services/gachaCharacterService.js'

import { uploadImage } from '../../services/imageService.js'

import { showToast, TOAST_TYPES } from '../Toast.jsx'



const EMPTY_FORM = {

  name: '',

  grade: 'common',

  dropWeight: GACHA_GRADE_DEFAULT_DROP_WEIGHT.common,

  isActive: true,

  imageUrl: '',

  imagePreview: '',

}



/**

 * 관리자: 포실이 캐릭터 등록·관리

 */

export default function GachaCharacterManagement() {

  const [characters, setCharacters] = useState([])

  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)

  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState(EMPTY_FORM)

  const [isUploading, setIsUploading] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  const fileInputRef = useRef(null)



  const load = async () => {

    setLoading(true)

    try {

      const data = await getAllGachaCharacters()

      setCharacters(data)

    } catch {

      showToast('포실이 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)

    } finally {

      setLoading(false)

    }

  }



  useEffect(() => {

    load()

  }, [])



  const handleGradeChange = (grade) => {

    setForm((prev) => ({

      ...prev,

      grade,

      dropWeight: GACHA_GRADE_DEFAULT_DROP_WEIGHT[grade] ?? 100,

    }))

  }



  const handleImageSelect = async (e) => {

    const file = e.target.files?.[0]

    if (!file) return



    setIsUploading(true)

    try {

      const url = await uploadImage(file, 'gacha-characters')

      setForm((prev) => ({ ...prev, imageUrl: url, imagePreview: url }))

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



  const openEdit = (char) => {

    setEditingId(char.id)

    setForm({

      name: char.name,

      grade: char.grade,

      dropWeight: char.dropWeight,

      isActive: char.isActive,

      imageUrl: char.imageUrl,

      imagePreview: char.imageUrl,

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

      const payload = {

        name: form.name,

        grade: form.grade,

        imageUrl: form.imageUrl,

        dropWeight: Number(form.dropWeight) || 100,

        isActive: form.isActive,

      }



      if (editingId) {

        await updateGachaCharacter(editingId, payload)

        showToast('포실이가 수정되었습니다.', TOAST_TYPES.SUCCESS)

      } else {

        await createGachaCharacter(payload)

        showToast('포실이가 등록되었습니다.', TOAST_TYPES.SUCCESS)

      }



      setShowForm(false)

      load()

    } catch (error) {

      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)

    } finally {

      setIsSaving(false)

    }

  }



  const handleDelete = async (id) => {

    if (!confirm('이 포실이를 삭제하시겠습니까?')) return

    try {

      await deleteGachaCharacter(id)

      showToast('삭제되었습니다.', TOAST_TYPES.SUCCESS)

      load()

    } catch (error) {

      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)

    }

  }



  const toggleActive = async (char) => {

    try {

      await updateGachaCharacter(char.id, { isActive: !char.isActive })

      load()

    } catch (error) {

      showToast(error?.message || '상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)

    }

  }



  if (loading) {

    return (

      <div className="text-center py-12 text-gray-500 font-sans">로딩 중...</div>

    )

  }



  return (

    <div className="space-y-6 font-sans">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <p className="text-sm text-gray-600">

          포실이 이름·등급·이미지를 등록하면 가챠 뽑기 풀에 반영됩니다.

        </p>

        <button

          type="button"

          onClick={openCreate}

          className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600"

        >

          + 포실이 등록

        </button>

      </div>



      {showForm && (

        <form

          onSubmit={handleSave}

          className="rounded-xl border-2 border-pink-200 bg-pink-50/50 p-6 space-y-4"

        >

          <h3 className="text-lg font-bold text-gray-800">

            {editingId ? '포실이 수정' : '포실이 등록'}

          </h3>



          <label className="block">

            <span className="text-sm font-medium text-gray-700">이름 *</span>

            <input

              type="text"

              value={form.name}

              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}

              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"

              placeholder="예: 행복한 포실이"

              required

            />

          </label>



          <div>

            <span className="text-sm font-medium text-gray-700">등급 *</span>

            <div className="mt-2 flex flex-wrap gap-2">

              {GACHA_GRADES.map((g) => (

                <button

                  key={g.id}

                  type="button"

                  onClick={() => handleGradeChange(g.id)}

                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${

                    form.grade === g.id ? g.colorClass + ' ring-2 ring-offset-1 ' + g.ringClass : 'bg-white border-gray-200 text-gray-600'

                  }`}

                >

                  {g.label}

                </button>

              ))}

            </div>

          </div>



          <label className="block">

            <span className="text-sm font-medium text-gray-700">드롭 가중치</span>

            <input

              type="number"

              min={1}

              value={form.dropWeight}

              onChange={(e) => setForm((p) => ({ ...p, dropWeight: e.target.value }))}

              className="mt-1 w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg"

            />

            <p className="text-xs text-gray-500 mt-1">숫자가 클수록 더 자주 나옵니다 (등급별 기본 확률도 적용)</p>

          </label>



          <div>

            <span className="text-sm font-medium text-gray-700">이미지 *</span>

            <div className="mt-2 flex flex-wrap items-start gap-4">

              {form.imagePreview && (

                <img

                  src={form.imagePreview}

                  alt="미리보기"

                  className="w-24 h-24 object-contain rounded-lg border-2 border-gray-200 bg-white"

                />

              )}

              <div>

                <input

                  ref={fileInputRef}

                  type="file"

                  accept="image/*"

                  onChange={handleImageSelect}

                  className="hidden"

                  id="gacha-char-image"

                />

                <label

                  htmlFor="gacha-char-image"

                  className={`inline-block px-4 py-2 rounded-lg border-2 border-dashed border-pink-300 text-pink-700 cursor-pointer hover:bg-pink-50 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}

                >

                  {isUploading ? '업로드 중...' : '📷 이미지 업로드'}

                </label>

              </div>

            </div>

          </div>



          <label className="flex items-center gap-2">

            <input

              type="checkbox"

              checked={form.isActive}

              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}

            />

            <span className="text-sm text-gray-700">뽑기 풀에 노출 (활성)</span>

          </label>



          <div className="flex gap-2 pt-2">

            <button

              type="submit"

              disabled={isSaving || isUploading}

              className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 disabled:opacity-50"

            >

              {isSaving ? '저장 중...' : '저장'}

            </button>

            <button

              type="button"

              onClick={() => setShowForm(false)}

              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"

            >

              취소

            </button>

          </div>

        </form>

      )}



      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-200">

          <h3 className="text-lg font-semibold text-gray-800">

            등록된 포실이 ({characters.length}종)

          </h3>

        </div>



        {characters.length === 0 ? (

          <p className="px-6 py-12 text-center text-gray-500">등록된 포실이가 없습니다.</p>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="bg-gray-50 border-b border-gray-200">

                <tr>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">이미지</th>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">이름</th>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">등급</th>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">가중치</th>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">상태</th>

                  <th className="text-left px-4 py-3 font-semibold text-gray-700">관리</th>

                </tr>

              </thead>

              <tbody>

                {characters.map((char) => {

                  const gradeMeta = getGachaGradeMeta(char.grade)

                  return (

                    <tr key={char.id} className="border-b border-gray-100 hover:bg-gray-50">

                      <td className="px-4 py-3">

                        <img

                          src={char.imageUrl}

                          alt={char.name}

                          className="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-white"

                        />

                      </td>

                      <td className="px-4 py-3 font-medium text-gray-800">{char.name}</td>

                      <td className="px-4 py-3">

                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${gradeMeta.colorClass}`}>

                          {gradeMeta.label}

                        </span>

                      </td>

                      <td className="px-4 py-3 text-gray-600">{char.dropWeight}</td>

                      <td className="px-4 py-3">

                        <button

                          type="button"

                          onClick={() => toggleActive(char)}

                          className={`px-2 py-0.5 rounded text-xs font-semibold ${

                            char.isActive

                              ? 'bg-green-100 text-green-800'

                              : 'bg-gray-100 text-gray-500'

                          }`}

                        >

                          {char.isActive ? '활성' : '비활성'}

                        </button>

                      </td>

                      <td className="px-4 py-3">

                        <div className="flex gap-1">

                          <button

                            type="button"

                            onClick={() => openEdit(char)}

                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"

                          >

                            수정

                          </button>

                          <button

                            type="button"

                            onClick={() => handleDelete(char.id)}

                            className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"

                          >

                            삭제

                          </button>

                        </div>

                      </td>

                    </tr>

                  )

                })}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>

  )

}


