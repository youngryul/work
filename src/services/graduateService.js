import { supabase } from '../config/supabase.js'

/**
 * 대학원 노트 서비스
 * graduate_notes 테이블 CRUD
 */

/**
 * 노트 목록 조회 (과목별, category 생략 시 전체 카테고리)
 * @param {{ semesterId: string, subjectName: string, category?: string }} params
 * @returns {Promise<Array>}
 */
export async function fetchNotes({ semesterId, subjectName, category }) {
  let query = supabase
    .from('graduate_notes')
    .select('id, title, note_date, category, created_at, updated_at')
    .eq('semester_id', semesterId)
    .eq('subject_name', subjectName)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
    .order('note_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('대학원 노트 목록 조회 오류:', error)
    throw new Error(`노트 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return data ?? []
}

/**
 * 노트 단건 조회
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function fetchNote(id) {
  const { data, error } = await supabase
    .from('graduate_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('대학원 노트 단건 조회 오류:', error)
    throw new Error(`노트를 불러오지 못했습니다: ${error.message}`)
  }

  return data
}

/**
 * 노트 생성
 * @param {{ semesterId: string, subjectName: string, category: string, title: string, content: Array, noteDate: string }} params
 * @returns {Promise<Object>}
 */
export async function createNote({ semesterId, subjectName, category, title, content, noteDate }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('graduate_notes')
    .insert({
      user_id: user.id,
      semester_id: semesterId,
      subject_name: subjectName,
      category,
      title: title ?? '',
      content: content ?? [],
      note_date: noteDate ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) {
    console.error('대학원 노트 생성 오류:', error)
    throw new Error(`노트를 생성하지 못했습니다: ${error.message}`)
  }

  return data
}

/**
 * 노트 수정
 * @param {string} id
 * @param {{ title?: string, content?: Array, noteDate?: string }} updates
 * @returns {Promise<Object>}
 */
export async function updateNote(id, { title, content, noteDate }) {
  const updates = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  if (noteDate !== undefined) updates.note_date = noteDate

  const { data, error } = await supabase
    .from('graduate_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('대학원 노트 수정 오류:', error)
    throw new Error(`노트를 수정하지 못했습니다: ${error.message}`)
  }

  return data
}

/**
 * 노트 삭제
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteNote(id) {
  const { error } = await supabase
    .from('graduate_notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('대학원 노트 삭제 오류:', error)
    throw new Error(`노트를 삭제하지 못했습니다: ${error.message}`)
  }
}
