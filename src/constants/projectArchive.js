/** 프로젝트 기록 — 프로젝트 보관 상수 */

/** 보관 프로젝트 테이블명 */
export const ARCHIVED_PROJECTS_TABLE = 'archived_projects'

/** 보관 관련 화면 라벨 */
export const PROJECT_ARCHIVE_LABELS = {
  activeView: '프로젝트',
  archiveView: '보관함',
  archive: '보관',
  unarchive: '복원',
}

/** archived_projects 테이블이 아직 없을 때 안내 문구 */
export const PROJECT_ARCHIVE_TABLE_MISSING_MESSAGE =
  '보관 기능이 DB에 없어요. supabase-archived-projects.sql을 Supabase에서 실행해 주세요.'
