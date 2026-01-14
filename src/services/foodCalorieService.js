import OpenAI from 'openai'
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 음식 칼로리 계산 서비스
 * 음식 사진 인식 및 칼로리 정보 제공
 */

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

/**
 * 음식 사진에서 음식명 추정
 * @param {File|string} imageFile - 업로드된 이미지 파일 또는 이미지 URL
 * @returns {Promise<string>} 추정된 음식명
 */
export async function recognizeFoodFromImage(imageFile) {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 추가해주세요.')
  }

  try {
    let imageUrl
    
    // File 객체인 경우 base64로 변환
    if (imageFile instanceof File) {
      const base64 = await fileToBase64(imageFile)
      imageUrl = `data:image/${imageFile.type.split('/')[1]};base64,${base64}`
    } else {
      // 이미 URL인 경우
      imageUrl = imageFile
    }

    // OpenAI Vision API로 음식 인식
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 비용 효율적인 모델 사용
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '이 사진에 있는 음식의 이름을 한국어로 정확히 알려주세요. 여러 음식이 있다면 모두 나열해주세요. 음식명만 간단하게 답변해주세요. 예: "김치찌개", "비빔밥", "치킨, 감자튀김"',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 100,
    })

    const foodName = response.choices[0]?.message?.content?.trim()
    
    if (!foodName) {
      throw new Error('음식을 인식할 수 없습니다.')
    }

    return foodName
  } catch (error) {
    console.error('음식 인식 오류:', error)
    throw new Error(`음식 인식 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * File을 base64로 변환
 * @param {File} file - 변환할 파일
 * @returns {Promise<string>} base64 문자열
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1] // data:image/...;base64, 부분 제거
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 음식명으로 칼로리 및 영양 정보 추정
 * @param {string} foodName - 음식명
 * @returns {Promise<{calories: number, carbs: number, protein: number, fat: number, servingSize: string}>} 영양 정보
 */
export async function estimateCalories(foodName) {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  try {
    // OpenAI를 사용하여 음식의 칼로리 및 영양 정보 추정
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 영양 전문가입니다. 음식명을 받으면 1인분 기준으로 칼로리와 탄수화물, 단백질, 지방의 그램 수를 추정합니다. 응답은 JSON 형식으로만 제공하세요.',
        },
        {
          role: 'user',
          content: `${foodName}의 1인분 기준 칼로리와 영양 정보를 추정해주세요. JSON 형식으로만 답변해주세요. 형식: {"calories": 숫자, "carbs": 숫자, "protein": 숫자, "fat": 숫자, "servingSize": "1인분"}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('영양 정보를 가져올 수 없습니다.')
    }

    const nutritionInfo = JSON.parse(content)
    
    // 기본값 설정 및 검증
    return {
      calories: Math.round(nutritionInfo.calories || 0),
      carbs: Math.round((nutritionInfo.carbs || 0) * 10) / 10,
      protein: Math.round((nutritionInfo.protein || 0) * 10) / 10,
      fat: Math.round((nutritionInfo.fat || 0) * 10) / 10,
      servingSize: nutritionInfo.servingSize || '1인분',
    }
  } catch (error) {
    console.error('칼로리 추정 오류:', error)
    throw new Error(`칼로리 추정 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 하루 권장 칼로리 계산 (Harris-Benedict 공식 기반)
 * @param {number} age - 나이
 * @param {string} gender - 성별 ('male' | 'female')
 * @param {number} height - 키 (cm)
 * @param {number} weight - 몸무게 (kg)
 * @param {string} activityLevel - 활동 수준 ('sedentary' | 'light' | 'moderate' | 'active' | 'very_active')
 * @returns {number} 하루 권장 칼로리 (kcal)
 */
export function calculateDailyCalories(age, gender, height, weight, activityLevel = 'moderate') {
  // BMR (기초대사율) 계산
  let bmr
  if (gender === 'male') {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
  } else {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
  }

  // 활동 계수
  const activityMultipliers = {
    sedentary: 1.2,      // 거의 운동 안 함
    light: 1.375,        // 가벼운 운동 (주 1-3일)
    moderate: 1.55,      // 적당한 운동 (주 3-5일)
    active: 1.725,       // 적극적인 운동 (주 6-7일)
    very_active: 1.9,    // 매우 적극적인 운동 (하루 2회 이상)
  }

  const multiplier = activityMultipliers[activityLevel] || 1.55
  const dailyCalories = Math.round(bmr * multiplier)

  return dailyCalories
}

/**
 * 음식 칼로리 기록 저장
 * @param {Object} recordData - 기록 데이터
 * @param {string} recordData.foodName - 음식명
 * @param {number} recordData.calories - 칼로리
 * @param {number} recordData.carbs - 탄수화물 (g)
 * @param {number} recordData.protein - 단백질 (g)
 * @param {number} recordData.fat - 지방 (g)
 * @param {string} recordData.servingSize - 1인분 등
 * @param {string} recordData.imageUrl - 이미지 URL (선택)
 * @param {string} recordData.mealDate - 식사 날짜 (YYYY-MM-DD 형식, 선택)
 * @param {string} recordData.mealType - 식사 종류 ('breakfast' | 'lunch' | 'dinner' | 'snack', 선택)
 * @param {string} recordData.notes - 메모 (선택)
 * @returns {Promise<Object>} 저장된 기록
 */
export async function saveFoodCalorieRecord(recordData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('food_calorie_records')
    .insert({
      user_id: userId,
      food_name: recordData.foodName,
      calories: recordData.calories,
      carbs: recordData.carbs,
      protein: recordData.protein,
      fat: recordData.fat,
      serving_size: recordData.servingSize || '1인분',
      image_url: recordData.imageUrl || null,
      meal_date: recordData.mealDate || new Date().toISOString().split('T')[0],
      meal_type: recordData.mealType || null,
      notes: recordData.notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('칼로리 기록 저장 오류:', error)
    throw new Error(`칼로리 기록 저장 실패: ${error.message}`)
  }

  return data
}

/**
 * 음식 칼로리 기록 조회
 * @param {Object} options - 조회 옵션
 * @param {string} options.startDate - 시작 날짜 (YYYY-MM-DD 형식, 선택)
 * @param {string} options.endDate - 종료 날짜 (YYYY-MM-DD 형식, 선택)
 * @param {number} options.limit - 조회 개수 제한 (선택)
 * @returns {Promise<Array>} 칼로리 기록 목록
 */
export async function getFoodCalorieRecords(options = {}) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 식사 종류 순서 정의 (아침, 점심, 저녁, 간식)
  const mealTypeOrder = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 }

  let query = supabase
    .from('food_calorie_records')
    .select('*')
    .eq('user_id', userId)

  if (options.startDate) {
    query = query.gte('meal_date', options.startDate)
  }

  if (options.endDate) {
    query = query.lte('meal_date', options.endDate)
  }

  query = query
    .order('meal_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('칼로리 기록 조회 오류:', error)
    throw new Error(`칼로리 기록 조회 실패: ${error.message}`)
  }

  // 식사 종류별로 정렬 (아침, 점심, 저녁, 간식 순서)
  const sortedData = (data || []).sort((a, b) => {
    const aOrder = mealTypeOrder[a.meal_type] || 99
    const bOrder = mealTypeOrder[b.meal_type] || 99
    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }
    // 같은 식사 종류면 생성 시간 역순
    return new Date(b.created_at) - new Date(a.created_at)
  })

  if (options.limit) {
    return sortedData.slice(0, options.limit)
  }

  return sortedData
}

/**
 * 특정 날짜의 칼로리 기록 조회
 * @param {string} date - 날짜 (YYYY-MM-DD 형식)
 * @returns {Promise<Array>} 해당 날짜의 칼로리 기록 목록
 */
export async function getFoodCalorieRecordsByDate(date) {
  return getFoodCalorieRecords({ startDate: date, endDate: date })
}

/**
 * 음식 칼로리 기록 삭제
 * @param {string} recordId - 기록 ID
 * @returns {Promise<void>}
 */
export async function deleteFoodCalorieRecord(recordId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('food_calorie_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', userId)

  if (error) {
    console.error('칼로리 기록 삭제 오류:', error)
    throw new Error(`칼로리 기록 삭제 실패: ${error.message}`)
  }
}

/**
 * 특정 기간의 총 칼로리 합계 계산
 * @param {string} startDate - 시작 날짜 (YYYY-MM-DD 형식)
 * @param {string} endDate - 종료 날짜 (YYYY-MM-DD 형식)
 * @returns {Promise<{totalCalories: number, totalCarbs: number, totalProtein: number, totalFat: number, recordCount: number}>} 영양 정보 합계
 */
export async function getCalorieSummary(startDate, endDate) {
  const records = await getFoodCalorieRecords({ startDate, endDate })
  
  const summary = records.reduce(
    (acc, record) => ({
      totalCalories: acc.totalCalories + (record.calories || 0),
      totalCarbs: acc.totalCarbs + (Number(record.carbs) || 0),
      totalProtein: acc.totalProtein + (Number(record.protein) || 0),
      totalFat: acc.totalFat + (Number(record.fat) || 0),
      recordCount: acc.recordCount + 1,
    }),
    { totalCalories: 0, totalCarbs: 0, totalProtein: 0, totalFat: 0, recordCount: 0 }
  )

  return {
    ...summary,
    totalCarbs: Math.round(summary.totalCarbs * 10) / 10,
    totalProtein: Math.round(summary.totalProtein * 10) / 10,
    totalFat: Math.round(summary.totalFat * 10) / 10,
  }
}

/**
 * 사용자 정보 저장 (나이, 성별, 키, 몸무게, 활동 수준)
 * @param {Object} userInfo - 사용자 정보
 * @param {number} userInfo.age - 나이
 * @param {string} userInfo.gender - 성별 ('male' | 'female')
 * @param {number} userInfo.height - 키 (cm)
 * @param {number} userInfo.weight - 몸무게 (kg)
 * @param {string} userInfo.activityLevel - 활동 수준 ('sedentary' | 'light' | 'moderate' | 'active' | 'very_active')
 * @returns {Promise<Object>} 저장된 사용자 정보
 */
export async function saveUserInfo(userInfo) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 설정 확인
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116' && checkError.code !== '42P01') {
      console.error('user_preferences 확인 오류:', checkError)
      throw checkError
    }

    const updateData = {
      age: userInfo.age || null,
      gender: userInfo.gender || null,
      height: userInfo.height || null,
      weight: userInfo.weight || null,
      activity_level: userInfo.activityLevel || null,
    }

    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('user_preferences')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('사용자 정보 저장 오류:', error)
        throw new Error(`사용자 정보 저장 실패: ${error.message}`)
      }

      return data
    } else {
      // 새로 생성
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          ...updateData,
        })
        .select()
        .single()

      if (error) {
        console.error('사용자 정보 저장 오류:', error)
        throw new Error(`사용자 정보 저장 실패: ${error.message}`)
      }

      return data
    }
  } catch (error) {
    console.error('사용자 정보 저장 오류:', error)
    throw error
  }
}

/**
 * 사용자 정보 조회
 * @returns {Promise<{age: number|null, gender: string|null, height: number|null, weight: number|null, activityLevel: string|null}>} 사용자 정보
 */
export async function getUserInfo() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      age: null,
      gender: null,
      height: null,
      weight: null,
      activityLevel: null,
    }
  }

  try {
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('age, gender, height, weight, activity_level')
      .eq('user_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      console.warn('사용자 정보 조회 오류 (무시됨):', error)
    }

    if (!error && preferences) {
      return {
        age: preferences.age || null,
        gender: preferences.gender || null,
        height: preferences.height || null,
        weight: preferences.weight || null,
        activityLevel: preferences.activity_level || null,
      }
    }

    return {
      age: null,
      gender: null,
      height: null,
      weight: null,
      activityLevel: null,
    }
  } catch (err) {
    console.warn('사용자 정보 조회 중 오류 (무시됨):', err)
    return {
      age: null,
      gender: null,
      height: null,
      weight: null,
      activityLevel: null,
    }
  }
}
