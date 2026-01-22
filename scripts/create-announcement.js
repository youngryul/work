/**
 * 배포 후 공지사항을 수동으로 추가하는 스크립트
 * 
 * 사용법:
 * node scripts/create-announcement.js "제목" "내용" "버전"
 * 
 * 예시:
 * node scripts/create-announcement.js "새로운 기능 추가" "일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다." "1.2.0"
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('다음 환경 변수를 설정하세요:')
  console.error('  - SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const [title, content, version, priority = '10'] = process.argv.slice(2)

if (!title || !content) {
  console.error('❌ 사용법: node scripts/create-announcement.js "제목" "내용" [버전] [우선순위]')
  console.error('')
  console.error('예시:')
  console.error('  node scripts/create-announcement.js "새로운 기능 추가" "일기 작성 시 AI 이미지 자동 생성 기능이 추가되었습니다." "1.2.0"')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAnnouncement() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        version: version || null,
        is_active: true,
        priority: parseInt(priority, 10) || 10,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    console.log('✅ 공지사항이 성공적으로 생성되었습니다!')
    console.log('')
    console.log('제목:', data.title)
    console.log('내용:', data.content)
    if (data.version) {
      console.log('버전:', data.version)
    }
    console.log('우선순위:', data.priority)
    console.log('ID:', data.id)
  } catch (error) {
    console.error('❌ 공지사항 생성 실패:', error.message)
    process.exit(1)
  }
}

createAnnouncement()
