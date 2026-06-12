import { supabase } from '../config/supabase.js'

import { getCurrentUserId } from '../utils/authHelper.js'



/**

 * 가챠 1회 뽑기

 * @returns {Promise<{ pullId: string, characterId: string, name: string, grade: string, imageUrl: string }>}

 */

export async function drawGacha() {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const { data, error } = await supabase.rpc('draw_gacha_character')



  if (error) {

    console.error('가챠 뽑기 오류:', error)

    throw new Error(error.message || '뽑기에 실패했습니다.')

  }



  return {

    pullId: data.pullId,

    characterId: data.characterId,

    name: data.name,

    grade: data.grade,

    imageUrl: data.imageUrl,

  }

}



/**

 * 내 컬렉션 조회 (뽑은 포실이)

 * @returns {Promise<Array<{ pullId: string, characterId: string, name: string, grade: string, imageUrl: string, obtainedAt: string, count?: number }>>}

 */

export async function getMyGachaCollection() {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const { data, error } = await supabase

    .from('user_gacha_pulls')

    .select(`

      id,

      character_id,

      created_at,

      gacha_characters (

        id,

        name,

        grade,

        image_url

      )

    `)

    .eq('user_id', userId)

    .order('created_at', { ascending: false })



  if (error) throw error



  /** @type {Map<string, { characterId: string, name: string, grade: string, imageUrl: string, count: number, latestObtainedAt: string }>} */

  const grouped = new Map()



  ;(data || []).forEach((row) => {

    const char = row.gacha_characters

    if (!char) return



    const key = char.id

    const existing = grouped.get(key)

    if (existing) {

      existing.count += 1

      if (row.created_at > existing.latestObtainedAt) {

        existing.latestObtainedAt = row.created_at

      }

    } else {

      grouped.set(key, {

        characterId: char.id,

        name: char.name,

        grade: char.grade,

        imageUrl: char.image_url,

        count: 1,

        latestObtainedAt: row.created_at,

      })

    }

  })



  return Array.from(grouped.values()).sort(

    (a, b) => new Date(b.latestObtainedAt) - new Date(a.latestObtainedAt),

  )

}



/**

 * 총 뽑기 횟수

 * @returns {Promise<number>}

 */

export async function getMyGachaPullCount() {

  const userId = await getCurrentUserId()

  if (!userId) return 0



  const { count, error } = await supabase

    .from('user_gacha_pulls')

    .select('*', { count: 'exact', head: true })

    .eq('user_id', userId)



  if (error) return 0

  return count ?? 0

}


