import { useState, useRef, useEffect } from 'react'
import { 
  recognizeFoodFromImage, 
  estimateCalories, 
  calculateDailyCalories,
  saveFoodCalorieRecord,
  getFoodCalorieRecords,
  deleteFoodCalorieRecord,
  getCalorieSummary,
  saveUserInfo,
  getUserInfo
} from '../services/foodCalorieService.js'
import { uploadImage } from '../services/imageService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 음식 칼로리 계산 컴포넌트
 */
export default function FoodCalorieCalculator() {
  const [activeTab, setActiveTab] = useState('calculator') // 'calculator' | 'calendar'
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [foodName, setFoodName] = useState('')
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nutritionInfo, setNutritionInfo] = useState(null)
  const [savedImageUrl, setSavedImageUrl] = useState(null)
  
  // 사용자 정보
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState('moderate')
  
  // 기록 목록
  const [records, setRecords] = useState([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dailySummary, setDailySummary] = useState(null)
  const [mealType, setMealType] = useState('') // 식사 종류 (breakfast, lunch, dinner, snack)
  
  const fileInputRef = useRef(null)

  /**
   * 식사 종류 한글 변환
   */
  const getMealTypeLabel = (type) => {
    const labels = {
      breakfast: '아침',
      lunch: '점심',
      dinner: '저녁',
      snack: '간식',
    }
    return labels[type] || type
  }

  /**
   * 칼로리 변경 시 영양소 자동 계산
   * @param {number} newCalories - 새로운 칼로리
   * @param {Object} currentInfo - 현재 영양 정보
   * @returns {Object} 계산된 영양 정보
   */
  const calculateNutritionFromCalories = (newCalories, currentInfo) => {
    if (!currentInfo || newCalories <= 0) {
      return currentInfo
    }

    // 현재 각 영양소의 칼로리 계산
    const carbsCalories = currentInfo.carbs * 4
    const proteinCalories = currentInfo.protein * 4
    const fatCalories = currentInfo.fat * 9
    const totalCalories = carbsCalories + proteinCalories + fatCalories

    // 총 칼로리가 0이면 비율 계산 불가
    if (totalCalories === 0) {
      return currentInfo
    }

    // 각 영양소의 칼로리 비율 계산
    const carbsRatio = carbsCalories / totalCalories
    const proteinRatio = proteinCalories / totalCalories
    const fatRatio = fatCalories / totalCalories

    // 새로운 칼로리를 비율에 맞게 분배
    const newCarbsCalories = newCalories * carbsRatio
    const newProteinCalories = newCalories * proteinRatio
    const newFatCalories = newCalories * fatRatio

    // 그램 수로 변환 (탄수화물/단백질: 4kcal/g, 지방: 9kcal/g)
    const newCarbs = Math.round((newCarbsCalories / 4) * 10) / 10
    const newProtein = Math.round((newProteinCalories / 4) * 10) / 10
    const newFat = Math.round((newFatCalories / 9) * 10) / 10

    return {
      ...currentInfo,
      calories: newCalories,
      carbs: newCarbs,
      protein: newProtein,
      fat: newFat,
    }
  }

  /**
   * 이미지 파일 선택 핸들러
   */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드 가능합니다.', TOAST_TYPES.ERROR)
      return
    }

    setImageFile(file)
    
    // 미리보기 생성
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
    
    // 음식 인식 자동 실행
    handleRecognizeFood(file)
  }

  /**
   * 음식 인식 실행
   */
  const handleRecognizeFood = async (file = imageFile) => {
    if (!file && !imagePreview) {
      showToast('이미지를 먼저 업로드해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsRecognizing(true)
    try {
      // 이미지를 Supabase에 업로드 (저장용)
      let uploadedImageUrl = null
      if (file instanceof File) {
        try {
          uploadedImageUrl = await uploadImage(file, 'food-images')
          setSavedImageUrl(uploadedImageUrl)
        } catch (uploadError) {
          console.warn('이미지 업로드 실패 (인식은 계속 진행):', uploadError)
        }
      }
      
      // File 객체를 직접 사용하여 음식 인식 (base64 변환은 서비스 내부에서 처리)
      const recognizedFoodName = await recognizeFoodFromImage(file)
      setFoodName(recognizedFoodName)
      showToast('음식 인식 완료!', TOAST_TYPES.SUCCESS)
      
      // 자동으로 칼로리 계산
      if (recognizedFoodName) {
        handleCalculateCalories(recognizedFoodName)
      }
    } catch (error) {
      console.error('음식 인식 오류:', error)
      showToast(error.message || '음식 인식에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsRecognizing(false)
    }
  }

  /**
   * 칼로리 계산 실행
   */
  const handleCalculateCalories = async (food = foodName) => {
    if (!food.trim()) {
      showToast('음식명을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsCalculating(true)
    try {
      const info = await estimateCalories(food)
      setNutritionInfo(info)
      showToast('칼로리 계산 완료!', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('칼로리 계산 오류:', error)
      showToast(error.message || '칼로리 계산에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsCalculating(false)
    }
  }

  /**
   * 이미지 제거
   */
  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setFoodName('')
    setNutritionInfo(null)
    setSavedImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 칼로리 기록 저장
   */
  const handleSaveRecord = async () => {
    if (!nutritionInfo || !foodName.trim()) {
      showToast('저장할 정보가 없습니다.', TOAST_TYPES.ERROR)
      return
    }

    if (!mealType) {
      showToast('식사 종류를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSaving(true)
    try {
      await saveFoodCalorieRecord({
        foodName,
        calories: nutritionInfo.calories,
        carbs: nutritionInfo.carbs,
        protein: nutritionInfo.protein,
        fat: nutritionInfo.fat,
        servingSize: nutritionInfo.servingSize,
        imageUrl: savedImageUrl,
        mealDate: selectedDate,
        mealType: mealType,
      })

      showToast('칼로리 기록이 저장되었습니다!', TOAST_TYPES.SUCCESS)
      
      // 기록 목록 새로고침
      loadRecords()
      
      // 입력 초기화
      handleRemoveImage()
      setMealType('')
    } catch (error) {
      console.error('기록 저장 오류:', error)
      showToast(error.message || '기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 기록 목록 로드
   */
  const loadRecords = async () => {
    setIsLoadingRecords(true)
    try {
      const recordsData = await getFoodCalorieRecords({
        startDate: selectedDate,
        endDate: selectedDate,
      })
      setRecords(recordsData)
      
      // 일일 합계 계산
      const summary = await getCalorieSummary(selectedDate, selectedDate)
      setDailySummary(summary)
    } catch (error) {
      console.error('기록 조회 오류:', error)
      showToast('기록을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoadingRecords(false)
    }
  }

  /**
   * 기록 삭제
   */
  const handleDeleteRecord = async (recordId) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteFoodCalorieRecord(recordId)
      showToast('기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      loadRecords()
    } catch (error) {
      console.error('기록 삭제 오류:', error)
      showToast(error.message || '기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 날짜 변경 시 기록 새로고침
   */
  useEffect(() => {
    loadRecords()
  }, [selectedDate])

  /**
   * 컴포넌트 마운트 시 사용자 정보 로드
   */
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userInfo = await getUserInfo()
        if (userInfo.age) setAge(String(userInfo.age))
        if (userInfo.gender) setGender(userInfo.gender)
        if (userInfo.height) setHeight(String(userInfo.height))
        if (userInfo.weight) setWeight(String(userInfo.weight))
        if (userInfo.activityLevel) setActivityLevel(userInfo.activityLevel)
      } catch (error) {
        console.error('사용자 정보 로드 오류:', error)
      }
    }
    loadUserInfo()
  }, [])

  /**
   * 사용자 정보 변경 시 자동 저장 (디바운스)
   */
  useEffect(() => {
    const timer = setTimeout(async () => {
      // 최소한 하나의 값이라도 입력되어 있으면 저장
      if (age || gender || height || weight) {
        try {
          await saveUserInfo({
            age: age ? Number(age) : null,
            gender: gender || null,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
            activityLevel: activityLevel || 'moderate',
          })
          // 저장 성공 시 토스트는 표시하지 않음 (자동 저장이므로)
        } catch (error) {
          console.error('사용자 정보 저장 오류:', error)
          // 저장 실패해도 사용자에게 알리지 않음 (자동 저장이므로)
        }
      }
    }, 1000) // 1초 후 저장

    return () => clearTimeout(timer)
  }, [age, gender, height, weight, activityLevel])

  /**
   * 하루 권장 칼로리 계산
   */
  const dailyCalories = age && gender && height && weight
    ? calculateDailyCalories(Number(age), gender, Number(height), Number(weight), activityLevel)
    : null

  /**
   * 칼로리 비율 계산 (하루 권장 칼로리 대비)
   */
  const caloriePercentage = dailyCalories && nutritionInfo
    ? Math.round((nutritionInfo.calories / dailyCalories) * 100)
    : null

  // 달력 관련 상태
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calorieData, setCalorieData] = useState({})
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true)
  const [calendarDailyCalories, setCalendarDailyCalories] = useState(null)

  /**
   * 달력용 사용자 정보 로드 및 권장 칼로리 계산
   */
  useEffect(() => {
    if (activeTab === 'calendar') {
      const loadUserInfoForCalendar = async () => {
        try {
          const userInfo = await getUserInfo()
          if (userInfo.age && userInfo.gender && userInfo.height && userInfo.weight) {
            const recommended = calculateDailyCalories(
              userInfo.age,
              userInfo.gender,
              userInfo.height,
              userInfo.weight,
              userInfo.activityLevel || 'moderate'
            )
            setCalendarDailyCalories(recommended)
          }
        } catch (error) {
          console.error('사용자 정보 로드 오류:', error)
        }
      }
      loadUserInfoForCalendar()
    }
  }, [activeTab])

  /**
   * 달력 데이터 로드
   */
  const loadCalorieData = async () => {
    setIsLoadingCalendar(true)
    try {
      const year = calendarDate.getFullYear()
      const month = calendarDate.getMonth() + 1
      const lastDay = new Date(year, month, 0)
      const daysInMonth = lastDay.getDate()

      const dataMap = {}
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        try {
          const summary = await getCalorieSummary(dateString, dateString)
          if (summary.recordCount > 0) {
            dataMap[dateString] = {
              totalCalories: summary.totalCalories,
              dailyCalories: calendarDailyCalories,
            }
          }
        } catch (error) {
          console.error(`칼로리 데이터 로드 오류 (${dateString}):`, error)
        }
      }
      
      setCalorieData(dataMap)
    } catch (error) {
      console.error('칼로리 데이터 로드 오류:', error)
    } finally {
      setIsLoadingCalendar(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalorieData()
    }
  }, [calendarDate, activeTab])

  /**
   * 달력 그리드 생성
   */
  const generateCalendar = () => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const calendar = []
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']

    calendar.push(
      <div key="header" className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    )

    const days = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const data = calorieData[dateString]
      const totalCalories = data?.totalCalories || 0
      const isToday =
        year === new Date().getFullYear() &&
        month === new Date().getMonth() &&
        day === new Date().getDate()

      const isOverLimit = calendarDailyCalories && totalCalories > calendarDailyCalories
      const emoji = totalCalories > 0 ? (isOverLimit ? '😢' : '😊') : null

      days.push(
        <div
          key={day}
          className={`aspect-square border-2 rounded-lg p-2 cursor-pointer hover:bg-green-50 transition-colors ${
            isToday ? 'border-green-400 bg-green-50' : 'border-gray-200'
          }`}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`text-sm font-medium mb-1 ${isToday ? 'text-green-600' : 'text-gray-700'}`}>
              {day}
            </div>
            {totalCalories > 0 && (
              <>
                <div className="text-xs text-gray-600 mb-1">
                  {totalCalories.toLocaleString()} kcal
                </div>
                {emoji && (
                  <div className="text-xl">{emoji}</div>
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    calendar.push(
      <div key="days" className="grid grid-cols-7 gap-1">
        {days}
      </div>
    )

    return calendar
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          음식 칼로리
        </h1>
        <p className="text-xl text-gray-600">
          음식 사진을 업로드하거나 음식명을 입력하여 칼로리를 계산해보세요
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'calculator'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          계산기
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'calendar'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          달력
        </button>
      </div>

      {/* 계산기 탭 */}
      {activeTab === 'calculator' && (
        <>

      {/* 사용자 정보 입력 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-handwriting text-gray-700 mb-4">사용자 정보</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">나이</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            >
              <option value="">선택</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">키 (cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="170"
              className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">몸무게 (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="70"
              className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">활동 수준</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            >
              <option value="sedentary">거의 없음</option>
              <option value="light">가벼움</option>
              <option value="moderate">적당함</option>
              <option value="active">적극적</option>
              <option value="very_active">매우 적극적</option>
            </select>
          </div>
        </div>
        {dailyCalories && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">
              하루 권장 칼로리: <span className="font-bold text-green-600">{dailyCalories.toLocaleString()} kcal</span>
            </p>
          </div>
        )}
      </div>

      {/* 이미지 업로드 또는 음식명 입력 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-handwriting text-gray-700 mb-4">음식 정보</h2>
        
        {/* 이미지 업로드 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">음식 사진 업로드</label>
          {!imagePreview ? (
            <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="food-image-input"
              />
              <label
                htmlFor="food-image-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <span className="text-4xl mb-2">📷</span>
                <span className="text-gray-600">클릭하여 사진 업로드</span>
              </label>
            </div>
          ) : (
            <div className="relative">
              <img
                src={imagePreview}
                alt="음식 미리보기"
                className="w-full max-w-md mx-auto rounded-lg shadow-md"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
              {isRecognizing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                  <div className="text-white text-lg">음식 인식 중...</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 음식명 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">또는 음식명 직접 입력</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="예: 김치찌개, 비빔밥, 치킨"
              className="flex-1 px-4 py-3 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCalculateCalories()
                }
              }}
            />
            <button
              onClick={() => handleCalculateCalories()}
              disabled={isCalculating || !foodName.trim()}
              className="px-6 py-3 bg-green-400 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isCalculating ? '계산 중...' : '계산'}
            </button>
          </div>
        </div>
      </div>

      {/* 칼로리 및 영양 정보 표시 */}
      {nutritionInfo && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-handwriting text-gray-700 mb-4">영양 정보</h2>
          
          {/* 칼로리 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-lg font-medium text-gray-700">칼로리 (kcal)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={nutritionInfo.calories}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    // 칼로리 변경 시 영양소 자동 계산
                    const updatedInfo = calculateNutritionFromCalories(value, nutritionInfo)
                    setNutritionInfo(updatedInfo)
                  }}
                  className="w-32 px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 text-right text-2xl font-bold text-green-600"
                  min="0"
                />
                <span className="text-gray-600">kcal</span>
              </div>
            </div>
            {dailyCalories && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((nutritionInfo.calories / dailyCalories) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  하루 권장 칼로리의 <span className="font-bold">{Math.round((nutritionInfo.calories / dailyCalories) * 100)}%</span>
                  {nutritionInfo.calories > dailyCalories && (
                    <span className="text-red-500 ml-2">(권장량 초과)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* 탄/단/지 비율 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <label className="block text-sm text-gray-600 mb-2 text-center">탄수화물 (g)</label>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={nutritionInfo.carbs}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setNutritionInfo({ ...nutritionInfo, carbs: Math.round(value * 10) / 10 })
                  }}
                  className="w-24 px-2 py-1 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 text-center text-xl font-bold text-blue-600"
                  min="0"
                  step="0.1"
                />
                <span className="text-gray-600">g</span>
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <label className="block text-sm text-gray-600 mb-2 text-center">단백질 (g)</label>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={nutritionInfo.protein}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setNutritionInfo({ ...nutritionInfo, protein: Math.round(value * 10) / 10 })
                  }}
                  className="w-24 px-2 py-1 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 text-center text-xl font-bold text-green-600"
                  min="0"
                  step="0.1"
                />
                <span className="text-gray-600">g</span>
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <label className="block text-sm text-gray-600 mb-2 text-center">지방 (g)</label>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={nutritionInfo.fat}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setNutritionInfo({ ...nutritionInfo, fat: Math.round(value * 10) / 10 })
                  }}
                  className="w-24 px-2 py-1 border-2 border-yellow-200 rounded-lg focus:outline-none focus:border-yellow-400 text-center text-xl font-bold text-yellow-600"
                  min="0"
                  step="0.1"
                />
                <span className="text-gray-600">g</span>
              </div>
            </div>
          </div>

          {/* 참고 사항 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              ⚠️ 참고: 이 정보는 추정치이며 ±20~30% 오차가 있을 수 있습니다. 
              정확한 영양 정보가 필요한 경우 전문 영양사나 공식 영양 정보를 참고하세요.
            </p>
          </div>

          {/* 식사 종류 선택 및 저장 버튼 */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">식사 종류</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
              >
                <option value="">선택하세요</option>
                <option value="breakfast">아침</option>
                <option value="lunch">점심</option>
                <option value="dinner">저녁</option>
                <option value="snack">간식</option>
              </select>
            </div>
            <button
              onClick={handleSaveRecord}
              disabled={isSaving || !mealType}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isSaving ? '저장 중...' : '📝 기록 저장하기'}
            </button>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-handwriting text-gray-700">식사 기록</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
          />
        </div>

        {/* 일일 합계 */}
        {dailySummary && dailySummary.recordCount > 0 && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">오늘의 합계</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">총 칼로리</div>
                <div className="text-xl font-bold text-green-600">{dailySummary.totalCalories.toLocaleString()} kcal</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">탄수화물</div>
                <div className="text-xl font-bold text-blue-600">{dailySummary.totalCarbs}g</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">단백질</div>
                <div className="text-xl font-bold text-green-600">{dailySummary.totalProtein}g</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">지방</div>
                <div className="text-xl font-bold text-yellow-600">{dailySummary.totalFat}g</div>
              </div>
            </div>
            {dailyCalories && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((dailySummary.totalCalories / dailyCalories) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  하루 권장 칼로리의 <span className="font-bold">{Math.round((dailySummary.totalCalories / dailyCalories) * 100)}%</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* 기록 목록 */}
        {isLoadingRecords ? (
          <div className="text-center py-8 text-gray-500">로딩 중...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {selectedDate === new Date().toISOString().split('T')[0] ? '오늘의 기록이 없습니다.' : '해당 날짜의 기록이 없습니다.'}
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div key={record.id} className="border-2 border-green-100 rounded-lg p-4 hover:border-green-300 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{record.food_name}</h3>
                      {record.meal_type && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {getMealTypeLabel(record.meal_type)}
                        </span>
                      )}
                    </div>
                    {record.image_url && (
                      <img
                        src={record.image_url}
                        alt={record.food_name}
                        className="w-24 h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">칼로리</span>
                        <div className="font-bold text-green-600">{record.calories} kcal</div>
                      </div>
                      <div>
                        <span className="text-gray-600">탄수화물</span>
                        <div className="font-bold text-blue-600">{record.carbs}g</div>
                      </div>
                      <div>
                        <span className="text-gray-600">단백질</span>
                        <div className="font-bold text-green-600">{record.protein}g</div>
                      </div>
                      <div>
                        <span className="text-gray-600">지방</span>
                        <div className="font-bold text-yellow-600">{record.fat}g</div>
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-gray-600 mt-2">{record.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRecord(record.id)}
                    className="ml-4 text-red-500 hover:text-red-700 text-xl"
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* 달력 탭 */}
      {activeTab === 'calendar' && (
        <div>
          {calendarDailyCalories && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">
                하루 권장 칼로리: <span className="font-semibold">{calendarDailyCalories.toLocaleString()} kcal</span>
              </p>
            </div>
          )}

          {/* 달력 컨트롤 */}
          <div className="flex justify-between items-center mb-6 bg-white rounded-lg shadow-md p-4">
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold"
            >
              ← 이전 달
            </button>
            <h2 className="text-2xl font-handwriting text-gray-800">
              {calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCalendarDate(new Date())}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
              >
                오늘
              </button>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold"
              >
                다음 달 →
              </button>
            </div>
          </div>

          {/* 달력 */}
          {isLoadingCalendar ? (
            <div className="text-center py-12 text-gray-500 text-xl">로딩 중...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6">
              {generateCalendar()}
              
              {/* 범례 */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">😊</span>
                    <span className="text-gray-600">권장 칼로리 이하</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">😢</span>
                    <span className="text-gray-600">권장 칼로리 초과</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!calendarDailyCalories && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ 사용자 정보(나이, 성별, 키, 몸무게)를 입력하면 하루 권장 칼로리가 표시됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
