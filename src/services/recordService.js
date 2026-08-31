import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  ARCHIVED_PROJECTS_TABLE,
  ARCHIVED_PROJECTS_STORAGE_KEY_PREFIX,
} from '../constants/projectArchive.js'

/**
 * 프로젝트 기록 서비스
 * Supabase를 통한 CRUD 작업 수행
 */

/**
 * 모든 기록 조회
 * @param {Object} filters - 필터 옵션
 * @param {string|null} filters.keyword - 키워드 검색
 * @param {string|null} filters.startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string|null} filters.endDate - 종료 날짜 (YYYY-MM-DD)
 * @param {string|null} filters.projectName - 프로젝트명 필터
 * @returns {Promise<Array>} 기록 목록
 */
export async function getAllRecords(filters = {}) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  let query = supabase
    .from('project_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('createdat', { ascending: false })

  // 프로젝트명 필터
  if (filters.projectName) {
    query = query.eq('projectname', filters.projectName)
  }

  // 키워드 검색 (제목, 프로젝트명, 본문)
  if (filters.keyword) {
    query = query.or(
      `title.ilike.%${filters.keyword}%,projectname.ilike.%${filters.keyword}%,background.ilike.%${filters.keyword}%`
    )
  }

  // 날짜 필터
  if (filters.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('기록 조회 오류:', error)
    throw error
  }

  return data || []
}

/**
 * 모든 프로젝트명 목록 조회
 * @returns {Promise<Array>} 프로젝트명 목록 (중복 제거, 정렬)
 */
export async function getAllProjectNames() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  const { data, error } = await supabase
    .from('project_records')
    .select('projectname')
    .eq('user_id', userId)
    .order('projectname', { ascending: true })

  if (error) {
    console.error('프로젝트명 조회 오류:', error)
    throw error
  }

  // 중복 제거 및 정렬
  const uniqueProjects = [...new Set(data.map((item) => item.projectname))].sort()
  return uniqueProjects
}

/**
 * 프로젝트별 기록 개수 조회
 * @returns {Promise<Array>} 프로젝트명과 기록 개수 배열 [{ projectName, count }]
 */
export async function getProjectCounts() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  const { data, error } = await supabase
    .from('project_records')
    .select('projectname')
    .eq('user_id', userId)

  if (error) {
    console.error('프로젝트 개수 조회 오류:', error)
    throw error
  }

  // 프로젝트별 개수 계산
  const counts = {}
  if (data) {
    data.forEach((item) => {
      counts[item.projectname] = (counts[item.projectname] || 0) + 1
    })
  }

  // 배열로 변환 및 정렬
  return Object.entries(counts)
    .map(([projectName, count]) => ({ projectName, count }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
}

/**
 * archived_projects 테이블 미생성 여부 판별
 * @param {Object} error - Supabase 에러
 * @returns {boolean}
 */
function isArchiveTableMissing(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /could not find the table|does not exist|relation .* does not exist/i.test(
    error.message || '',
  )
}

/**
 * 사용자별 보관 목록 localStorage 키
 * @param {string} userId
 * @returns {string}
 */
function getLocalArchiveStorageKey(userId) {
  return `${ARCHIVED_PROJECTS_STORAGE_KEY_PREFIX}${userId}`
}

/**
 * 로컬에 저장된 보관 프로젝트명 목록
 * @param {string} userId
 * @returns {string[]}
 */
function readLocalArchivedNames(userId) {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getLocalArchiveStorageKey(userId)) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((name) => typeof name === 'string' && name.length > 0)
      : []
  } catch {
    return []
  }
}

/**
 * 로컬 보관 프로젝트명 목록 저장
 * @param {string} userId
 * @param {string[]} names
 * @returns {boolean} 저장 성공 여부
 */
function writeLocalArchivedNames(userId, names) {
  if (typeof window === 'undefined' || !userId) return false
  try {
    window.localStorage.setItem(
      getLocalArchiveStorageKey(userId),
      JSON.stringify([...new Set(names)]),
    )
    return true
  } catch (error) {
    console.error('로컬 보관 목록 저장 실패:', error)
    return false
  }
}

/**
 * 로컬 보관 목록에 프로젝트 추가
 * @param {string} userId
 * @param {string} projectName
 * @returns {boolean}
 */
function addLocalArchivedName(userId, projectName) {
  return writeLocalArchivedNames(userId, [...readLocalArchivedNames(userId), projectName])
}

/**
 * 로컬 보관 목록에서 프로젝트 제거
 * @param {string} userId
 * @param {string} projectName
 * @returns {boolean}
 */
function removeLocalArchivedName(userId, projectName) {
  return writeLocalArchivedNames(
    userId,
    readLocalArchivedNames(userId).filter((name) => name !== projectName),
  )
}

/**
 * 로컬에만 있는 보관 항목을 DB로 동기화 시도
 * @param {string} userId
 * @param {string[]} localNames
 * @param {string[]} dbNames
 */
function syncLocalArchivesToDb(userId, localNames, dbNames) {
  const dbNameSet = new Set(dbNames)
  const pending = localNames.filter((name) => !dbNameSet.has(name))
  if (pending.length === 0) return

  Promise.all(
    pending.map((projectName) =>
      supabase
        .from(ARCHIVED_PROJECTS_TABLE)
        .upsert(
          { user_id: userId, project_name: projectName },
          { onConflict: 'user_id,project_name', ignoreDuplicates: true },
        ),
    ),
  ).catch((error) => {
    console.error('로컬 보관 목록 DB 동기화 실패:', error)
  })
}

/**
 * 보관한 프로젝트명 목록 조회
 * @returns {Promise<string[]>} 보관한 프로젝트명 목록
 */
export async function getArchivedProjectNames() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  const localNames = readLocalArchivedNames(userId)
  const { data, error } = await supabase
    .from(ARCHIVED_PROJECTS_TABLE)
    .select('project_name')
    .eq('user_id', userId)

  if (error) {
    if (!isArchiveTableMissing(error)) {
      console.error('보관 프로젝트 조회 오류:', error)
    }
    return localNames
  }

  const dbNames = (data || []).map((row) => row.project_name)
  syncLocalArchivesToDb(userId, localNames, dbNames)
  return [...new Set([...dbNames, ...localNames])]
}

/**
 * 프로젝트 목록을 일반·보관으로 나눠 조회
 * @returns {Promise<{ activeProjects: Array, archivedProjects: Array }>} 일반·보관 프로젝트 목록
 */
export async function getProjectCountsByArchiveState() {
  const [projects, archivedNames] = await Promise.all([
    getProjectCounts(),
    getArchivedProjectNames(),
  ])

  const archivedNameSet = new Set(archivedNames)

  return {
    activeProjects: projects.filter((project) => !archivedNameSet.has(project.projectName)),
    archivedProjects: projects.filter((project) => archivedNameSet.has(project.projectName)),
  }
}

/**
 * 프로젝트 보관
 * @param {string} projectName - 프로젝트명
 * @returns {Promise<void>}
 */
export async function archiveProject(projectName) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  if (!projectName) {
    throw new Error('프로젝트명이 필요합니다.')
  }

  const savedLocally = addLocalArchivedName(userId, projectName)
  const { error } = await supabase
    .from(ARCHIVED_PROJECTS_TABLE)
    .upsert(
      { user_id: userId, project_name: projectName },
      { onConflict: 'user_id,project_name', ignoreDuplicates: true },
    )

  if (!error || (isArchiveTableMissing(error) && savedLocally)) {
    return
  }

  if (savedLocally) {
    console.error('프로젝트 보관 DB 동기화 실패:', error)
    return
  }

  console.error('프로젝트 보관 오류:', error)
  throw new Error(error?.message || '프로젝트 보관에 실패했습니다.')
}

/**
 * 프로젝트 보관 해제
 * @param {string} projectName - 프로젝트명
 * @returns {Promise<void>}
 */
export async function unarchiveProject(projectName) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  if (!projectName) {
    throw new Error('프로젝트명이 필요합니다.')
  }

  const savedLocally = removeLocalArchivedName(userId, projectName)
  const { error } = await supabase
    .from(ARCHIVED_PROJECTS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('project_name', projectName)

  if (!error || (isArchiveTableMissing(error) && savedLocally)) {
    return
  }

  if (savedLocally) {
    console.error('프로젝트 보관 해제 DB 동기화 실패:', error)
    return
  }

  console.error('프로젝트 보관 해제 오류:', error)
  throw new Error(error?.message || '프로젝트 보관 해제에 실패했습니다.')
}

/**
 * 프로젝트별 메인 기록 조회
 * @param {string} projectName - 프로젝트명
 * @returns {Promise<Object|null>} 메인 기록 데이터
 */
export async function getMainRecordByProject(projectName) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  const { data, error } = await supabase
    .from('project_records')
    .select('*')
    .eq('user_id', userId)
    .eq('projectname', projectName)
    .eq('is_main', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // 레코드를 찾을 수 없음
      return null
    }
    console.error('메인 기록 조회 오류:', error)
    throw error
  }

  return parseRecordData(data)
}

/**
 * 기록을 메인 기록으로 설정
 * @param {string} id - 기록 ID
 * @param {string} projectName - 프로젝트명
 * @returns {Promise<Object>} 업데이트된 기록
 */
export async function setMainRecord(id, projectName) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 1. 해당 프로젝트의 기존 메인 기록 해제
  const { error: updateError } = await supabase
    .from('project_records')
    .update({ is_main: false })
    .eq('user_id', userId)
    .eq('projectname', projectName)
    .eq('is_main', true)

  if (updateError) {
    console.error('기존 메인 기록 해제 오류:', updateError)
    throw updateError
  }

  // 2. 선택한 기록을 메인으로 설정
  const { data, error } = await supabase
    .from('project_records')
    .update({ is_main: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('메인 기록 설정 오류:', error)
    throw error
  }

  return parseRecordData(data)
}

/**
 * 메인 기록 해제
 * @param {string} id - 기록 ID
 * @returns {Promise<Object>} 업데이트된 기록
 */
export async function unsetMainRecord(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('project_records')
    .update({ is_main: false })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('메인 기록 해제 오류:', error)
    throw error
  }

  return parseRecordData(data)
}

/**
 * 기록 단건 조회
 * @param {string} id - 기록 ID
 * @returns {Promise<Object|null>} 기록 데이터
 */
export async function getRecordById(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  const { data, error } = await supabase
    .from('project_records')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // 레코드를 찾을 수 없음
      return null
    }
    console.error('기록 조회 오류:', error)
    throw error
  }

  return data
}

/**
 * 기록 생성
 * @param {Object} recordData - 기록 데이터
 * @returns {Promise<Object>} 생성된 기록
 */
export async function createRecord(recordData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 필드명 변환 (camelCase -> snake_case)
  // type 필드는 필수이므로 기본값 'MEETING' 설정
  const dataToInsert = {
    projectname: recordData.projectName,
    type: recordData.type || 'MEETING', // 기본값: MEETING
    date: recordData.date,
    title: recordData.title,
    background: recordData.content || recordData.background || null,
    discussion: recordData.discussion || null,
    problem: recordData.problem || null,
    decision: null,
    actionitems: null,
    is_main: recordData.isMain || false,
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('project_records')
    .insert([dataToInsert])
    .select()
    .single()

  if (error) {
    console.error('기록 생성 오류:', error)
    throw error
  }

  return parseRecordData(data)
}

/**
 * 기록 수정
 * @param {string} id - 기록 ID
 * @param {Object} recordData - 수정할 기록 데이터
 * @returns {Promise<Object>} 수정된 기록
 */
export async function updateRecord(id, recordData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 필드명 변환 (camelCase -> snake_case)
  const dataToUpdate = {
    projectname: recordData.projectName,
    type: recordData.type, // type 필드 추가
    date: recordData.date,
    title: recordData.title,
    background: recordData.content || recordData.background || null,
    discussion: recordData.discussion || null,
    problem: recordData.problem || null,
    decision: null,
    actionitems: null,
    is_main: recordData.isMain !== undefined ? recordData.isMain : undefined,
  }
  
  // undefined 필드 제거
  Object.keys(dataToUpdate).forEach(key => {
    if (dataToUpdate[key] === undefined) {
      delete dataToUpdate[key]
    }
  })

  const { data, error } = await supabase
    .from('project_records')
    .update(dataToUpdate)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('기록 수정 오류:', error)
    throw error
  }

  return parseRecordData(data)
}

/**
 * 기록 삭제
 * @param {string} id - 기록 ID
 * @returns {Promise<void>}
 */
export async function deleteRecord(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('project_records')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('기록 삭제 오류:', error)
    throw error
  }
}

/**
 * Supabase에서 가져온 데이터를 애플리케이션 형식으로 변환
 * @param {Object} data - Supabase 데이터
 * @returns {Object} 변환된 데이터
 */
function parseRecordData(data) {
  return {
    ...data,
    projectName: data.projectname,
    content: data.background || data.content || '',
    isMain: data.is_main || false,
  }
}
