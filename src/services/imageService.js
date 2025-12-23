import { supabase } from '../config/supabase.js'

/**
 * 이미지 업로드 서비스
 * Supabase Storage를 사용하여 이미지 업로드
 */

/**
 * 이미지 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} folder - 저장할 폴더명 (기본값: 'project-records')
 * @returns {Promise<string>} 업로드된 이미지의 공개 URL
 */
export async function uploadImage(file, folder = 'project-records') {
  // 파일 유효성 검사
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드 가능합니다.')
  }

  // 파일 크기 제한 (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('파일 크기는 10MB 이하여야 합니다.')
  }

  // 고유한 파일명 생성
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  try {
    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('이미지 업로드 오류:', error)
      
      // 더 명확한 에러 메시지 제공
      const errorMessage = error.message || error.toString() || ''
      
      if (errorMessage.includes('Bucket not found') || 
          errorMessage.includes('does not exist') ||
          errorMessage.includes('not found') ||
          error.statusCode === 404) {
        throw new Error('Storage 버킷이 생성되지 않았습니다. Supabase 대시보드 > Storage > Create a new bucket에서 "images" 버킷을 생성해주세요.')
      } else if (errorMessage.includes('new row violates row-level security') ||
                 errorMessage.includes('row-level security') ||
                 error.statusCode === 42501) {
        throw new Error('Storage 정책이 설정되지 않았습니다. Supabase SQL Editor에서 supabase-storage-setup.sql 파일을 실행해주세요.')
      } else {
        throw new Error(`이미지 업로드 실패: ${errorMessage || '알 수 없는 오류'}`)
      }
    }

    // 공개 URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from('images').getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('이미지 업로드 실패:', error)
    // 이미 처리된 에러는 그대로 throw
    if (error.message && (error.message.includes('버킷') || error.message.includes('정책'))) {
      throw error
    }
    throw new Error(`이미지 업로드 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 이미지 삭제
 * @param {string} filePath - 삭제할 파일 경로
 * @returns {Promise<void>}
 */
export async function deleteImage(filePath) {
  try {
    const { error } = await supabase.storage.from('images').remove([filePath])

    if (error) {
      console.error('이미지 삭제 오류:', error)
      throw error
    }
  } catch (error) {
    console.error('이미지 삭제 실패:', error)
    throw error
  }
}
