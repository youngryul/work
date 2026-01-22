import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 공지사항 서비스
 * Supabase를 통한 공지사항 CRUD 작업
 */

/**
 * 활성화된 공지사항 목록 조회 (사용자가 아직 보지 않은 것만)
 * @returns {Promise<Array>} 공지사항 목록
 */
export async function getUnreadAnnouncements() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    // 활성화된 공지사항 조회 (만료되지 않은 것만, 우선순위 순으로 정렬)
    const { data: announcements, error: announcementsError } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (announcementsError) {
      throw announcementsError
    }

    if (!announcements || announcements.length === 0) {
      return []
    }

    // 사용자가 이미 본 공지사항 ID 목록 조회
    const { data: views, error: viewsError } = await supabase
      .from('announcement_views')
      .select('announcement_id')
      .eq('user_id', userId)

    if (viewsError) {
      throw viewsError
    }

    const viewedIds = new Set(views?.map(v => v.announcement_id) || [])

    // 아직 보지 않은 공지사항만 필터링
    const unreadAnnouncements = announcements.filter(
      announcement => !viewedIds.has(announcement.id)
    )

    return unreadAnnouncements
  } catch (error) {
    console.error('공지사항 조회 실패:', error)
    throw error
  }
}

/**
 * 공지사항을 읽음 처리
 * @param {string} announcementId - 공지사항 ID
 * @returns {Promise<void>}
 */
export async function markAnnouncementAsRead(announcementId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('announcement_views')
      .upsert({
        user_id: userId,
        announcement_id: announcementId,
        viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,announcement_id'
      })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('공지사항 읽음 처리 실패:', error)
    throw error
  }
}

/**
 * 모든 활성화된 공지사항 조회 (관리자용)
 * @returns {Promise<Array>} 공지사항 목록
 */
export async function getAllActiveAnnouncements() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('공지사항 조회 실패:', error)
    throw error
  }
}
