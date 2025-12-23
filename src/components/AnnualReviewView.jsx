import { useState, useEffect, useCallback, useRef } from 'react'
import { getAnnualReview, saveAnnualReview } from '../services/annualReviewService.js'

/**
 * Day별 섹션 정의
 */
const DAY_SECTIONS = {
  1: {
    title: 'Day 1: 요약 & 타임라인',
    sections: ['0', '1', '2'],
    description: '올해의 한 줄 정의, 하이라이트, 월별 타임라인을 작성합니다.'
  },
  2: {
    title: 'Day 2: 선택·패턴 분석',
    sections: ['3', '4', '5', '6'],
    description: '잘한 것, 아쉬웠던 것, 반복 패턴, 나를 바꾼 결정을 분석합니다.'
  },
  3: {
    title: 'Day 3: 관계·인사이트',
    sections: ['7', '8', '9', '10'],
    description: '관계, 환경, 버린 것과 얻은 것, 인사이트를 정리합니다.'
  },
  4: {
    title: 'Day 4: 다음 해 기준 선언',
    sections: ['11', '12'],
    description: '다음 해를 위한 기준과 마무리 문장을 작성합니다.'
  }
}

/**
 * 연간 회고록 템플릿 데이터 구조
 */
const getInitialReviewData = () => ({
  '0': { oneLine: '', why: '', feeling: '' },
  '1': { keywords: ['', '', ''], scenes: ['', '', ''] },
  '2': { months: Array.from({ length: 12 }, () => ({ event: '', state: '', meaning: '' })) },
  '3': { keeps: Array.from({ length: 5 }, () => ({ action: '', reason: '' })), why: '' },
  '4': { problems: Array.from({ length: 3 }, () => ({ action: '', reason: '' })), why: '' },
  '5': { pattern: { signal: '', collapse: '', recovery: '' }, strengths: ['', '', ''] },
  '6': { decisions: Array.from({ length: 3 }, () => ({ decision: '', why: '', result: '', impact: '' })) },
  '7': { helpful: '', draining: '', maintain: '', clean: '' },
  '8': { discarded: { mindset: '', relationship: '', standard: '' }, gained: { capability: '', attitude: '', perspective: '' } },
  '9': { evaluation: '' },
  '10': { insights: Array.from({ length: 5 }, () => ''), different: Array.from({ length: 3 }, () => '') },
  '11': { criteria: '', notStop: '', growth: '' },
  '12': { closing: '' }
})

/**
 * 연간 회고록 뷰 컴포넌트
 */
export default function AnnualReviewView() {
  const [reviewData, setReviewData] = useState(getInitialReviewData())
  const [completedDays, setCompletedDays] = useState(new Set())
  const [currentDay, setCurrentDay] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef(null)

  /**
   * 데이터 로드
   */
  useEffect(() => {
    const loadReviewData = async () => {
      setIsLoading(true)
      try {
        const data = await getAnnualReview('2025')
        if (data) {
          setReviewData(data.reviewData)
          setCompletedDays(new Set(data.completedDays))
          // 완료된 Day 중 가장 높은 Day의 다음 Day를 현재 Day로 설정
          const maxCompletedDay = Math.max(...data.completedDays, 0)
          setCurrentDay(Math.min(maxCompletedDay + 1, 4))
        }
      } catch (error) {
        console.error('회고록 데이터 로드 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadReviewData()
  }, [])

  /**
   * 데이터 저장 (DB)
   */
  const saveReviewDataToDB = useCallback(async (data, completedDaysArray) => {
    setIsSaving(true)
    try {
      await saveAnnualReview('2025', data, completedDaysArray)
    } catch (error) {
      console.error('회고록 저장 오류:', error)
      alert('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSaving(false)
    }
  }, [])

  /**
   * 데이터 저장 (로컬 상태 업데이트 + DB 저장 - debounce)
   */
  const saveReviewData = useCallback((data) => {
    setReviewData(data)
    
    // 기존 타이머 취소
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    
    // 1초 후 자동 저장
    saveTimerRef.current = setTimeout(() => {
      const completedDaysArray = Array.from(completedDays)
      saveReviewDataToDB(data, completedDaysArray)
    }, 1000)
  }, [completedDays, saveReviewDataToDB])

  /**
   * 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  /**
   * Day 완료 처리
   */
  const handleDayComplete = async (day) => {
    const newCompletedDays = new Set(completedDays)
    newCompletedDays.add(day)
    setCompletedDays(newCompletedDays)
    
    const completedDaysArray = Array.from(newCompletedDays)
    await saveReviewDataToDB(reviewData, completedDaysArray)
    
    // 다음 Day로 이동
    if (day < 4) {
      setCurrentDay(day + 1)
    }
  }

  /**
   * 섹션 0: 올해 한 줄 정의
   */
  const renderSection0 = () => {
    const data = reviewData['0']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">0️⃣ 올해 한 줄 정의</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">2025년은 나에게 __________________________ 한 해였다.</label>
            <textarea
              value={data.oneLine}
              onChange={(e) => saveReviewData({ ...reviewData, '0': { ...data, oneLine: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="2"
              placeholder="예: 도전과 성장이 공존한"
            />
          </div>
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">왜 이 문장이 나에게 가장 맞는가?</label>
            <textarea
              value={data.why}
              onChange={(e) => saveReviewData({ ...reviewData, '0': { ...data, why: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="3"
            />
          </div>
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">이 문장을 1년 뒤 다시 읽는다면 어떤 기분일까?</label>
            <textarea
              value={data.feeling}
              onChange={(e) => saveReviewData({ ...reviewData, '0': { ...data, feeling: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="3"
            />
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 1: 연간 하이라이트 요약
   */
  const renderSection1 = () => {
    const data = reviewData['1']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">1️⃣ 연간 하이라이트 요약</h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해의 키워드 3가지</h3>
            <div className="space-y-4">
              {data.keywords.map((keyword, index) => (
                <div key={index}>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">키워드 {index + 1}:</label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => {
                      const newKeywords = [...data.keywords]
                      newKeywords[index] = e.target.value
                      saveReviewData({ ...reviewData, '1': { ...data, keywords: newKeywords } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    placeholder={`키워드 ${index + 1} 입력`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해의 대표 장면 TOP 3</h3>
            <div className="space-y-4">
              {data.scenes.map((scene, index) => (
                <div key={index}>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">장면 {index + 1}:</label>
                  <textarea
                    value={scene}
                    onChange={(e) => {
                      const newScenes = [...data.scenes]
                      newScenes[index] = e.target.value
                      saveReviewData({ ...reviewData, '1': { ...data, scenes: newScenes } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    rows="3"
                    placeholder={`장면 ${index + 1}을 자세히 설명해주세요`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 2: 월별 타임라인 회고
   */
  const renderSection2 = () => {
    const data = reviewData['2']
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">2️⃣ 월별 타임라인 회고</h2>
        <p className="text-lg text-gray-600 mb-6 font-sans">각 월은 '사건 1개 + 상태 1개'만 기록합니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-gray-300 p-3 text-left text-lg font-sans">월</th>
                <th className="border-2 border-gray-300 p-3 text-left text-lg font-sans">했던 일 (사건)</th>
                <th className="border-2 border-gray-300 p-3 text-left text-lg font-sans">그때의 나 (상태/감정)</th>
                <th className="border-2 border-gray-300 p-3 text-left text-lg font-sans">한 줄 의미</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, index) => (
                <tr key={index}>
                  <td className="border-2 border-gray-300 p-3 font-semibold text-lg font-sans">{month}</td>
                  <td className="border-2 border-gray-300 p-3">
                    <textarea
                      value={data.months[index].event}
                      onChange={(e) => {
                        const newMonths = [...data.months]
                        newMonths[index] = { ...newMonths[index], event: e.target.value }
                        saveReviewData({ ...reviewData, '2': { ...data, months: newMonths } })
                      }}
                      className="w-full p-2 border border-gray-200 rounded text-base focus:border-pink-400 focus:outline-none font-sans"
                      rows="2"
                    />
                  </td>
                  <td className="border-2 border-gray-300 p-3">
                    <textarea
                      value={data.months[index].state}
                      onChange={(e) => {
                        const newMonths = [...data.months]
                        newMonths[index] = { ...newMonths[index], state: e.target.value }
                        saveReviewData({ ...reviewData, '2': { ...data, months: newMonths } })
                      }}
                      className="w-full p-2 border border-gray-200 rounded text-base focus:border-pink-400 focus:outline-none font-sans"
                      rows="2"
                    />
                  </td>
                  <td className="border-2 border-gray-300 p-3">
                    <textarea
                      value={data.months[index].meaning}
                      onChange={(e) => {
                        const newMonths = [...data.months]
                        newMonths[index] = { ...newMonths[index], meaning: e.target.value }
                        saveReviewData({ ...reviewData, '2': { ...data, months: newMonths } })
                      }}
                      className="w-full p-2 border border-gray-200 rounded text-base focus:border-pink-400 focus:outline-none font-sans"
                      rows="2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /**
   * 섹션 3: 잘한 것 회고
   */
  const renderSection3 = () => {
    const data = reviewData['3']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">3️⃣ 잘한 것 회고 (Keep)</h2>
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해 잘한 선택 / 행동 5가지</h3>
          {data.keeps.map((keep, index) => (
            <div key={index} className="p-4 border-2 border-gray-200 rounded-lg">
              <label className="block text-lg mb-2 text-gray-600 font-semibold font-sans">{index + 1}번:</label>
              <textarea
                value={keep.action}
                onChange={(e) => {
                  const newKeeps = [...data.keeps]
                  newKeeps[index] = { ...newKeeps[index], action: e.target.value }
                  saveReviewData({ ...reviewData, '3': { ...data, keeps: newKeeps } })
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none mb-3 font-sans"
                rows="2"
                placeholder="잘한 선택/행동을 입력하세요"
              />
              <textarea
                value={keep.reason}
                onChange={(e) => {
                  const newKeeps = [...data.keeps]
                  newKeeps[index] = { ...newKeeps[index], reason: e.target.value }
                  saveReviewData({ ...reviewData, '3': { ...data, keeps: newKeeps } })
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                rows="2"
                placeholder="왜 잘한 선택이었는지 입력하세요"
              />
            </div>
          ))}
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">왜 이 선택은 잘한 선택이었는가?</label>
            <textarea
              value={data.why}
              onChange={(e) => saveReviewData({ ...reviewData, '3': { ...data, why: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="4"
              placeholder="결과 때문인가? 나의 기준을 지켰기 때문인가? 회피하지 않았기 때문인가?"
            />
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 4: 아쉬웠던 것 회고
   */
  const renderSection4 = () => {
    const data = reviewData['4']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">4️⃣ 아쉬웠던 것 회고 (Problem)</h2>
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 아쉬웠던 선택 / 놓친 기회 3가지</h3>
          {data.problems.map((problem, index) => (
            <div key={index} className="p-4 border-2 border-gray-200 rounded-lg">
              <label className="block text-lg mb-2 text-gray-600 font-semibold font-sans">{index + 1}번:</label>
              <textarea
                value={problem.action}
                onChange={(e) => {
                  const newProblems = [...data.problems]
                  newProblems[index] = { ...newProblems[index], action: e.target.value }
                  saveReviewData({ ...reviewData, '4': { ...data, problems: newProblems } })
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none mb-3 font-sans"
                rows="2"
                placeholder="아쉬웠던 선택/놓친 기회를 입력하세요"
              />
              <textarea
                value={problem.reason}
                onChange={(e) => {
                  const newProblems = [...data.problems]
                  newProblems[index] = { ...newProblems[index], reason: e.target.value }
                  saveReviewData({ ...reviewData, '4': { ...data, problems: newProblems } })
                }}
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                rows="2"
                placeholder="그 당시의 나는 왜 그렇게 선택했는가? (정보 부족, 감정적 상태, 두려움/조급함/완벽주의 등)"
              />
            </div>
          ))}
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
            <p className="text-lg text-yellow-800 font-semibold font-sans">❗ 자책 금지. 이해가 목적</p>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 5: 나의 반복 패턴 분석
   */
  const renderSection5 = () => {
    const data = reviewData['5']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">5️⃣ 나의 반복 패턴 분석</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해 가장 자주 반복된 패턴</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">흔들릴 때의 전조 신호:</label>
                <textarea
                  value={data.pattern.signal}
                  onChange={(e) => saveReviewData({ ...reviewData, '5': { ...data, pattern: { ...data.pattern, signal: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">무너지는 방식:</label>
                <textarea
                  value={data.pattern.collapse}
                  onChange={(e) => saveReviewData({ ...reviewData, '5': { ...data, pattern: { ...data.pattern, collapse: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">회복하는 방식:</label>
                <textarea
                  value={data.pattern.recovery}
                  onChange={(e) => saveReviewData({ ...reviewData, '5': { ...data, pattern: { ...data.pattern, recovery: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해 새로 발견한 나의 강점</h3>
            {data.strengths.map((strength, index) => (
              <div key={index} className="mb-4">
                <label className="block text-lg mb-2 text-gray-600 font-sans">강점 {index + 1}:</label>
                <input
                  type="text"
                  value={strength}
                  onChange={(e) => {
                    const newStrengths = [...data.strengths]
                    newStrengths[index] = e.target.value
                    saveReviewData({ ...reviewData, '5': { ...data, strengths: newStrengths } })
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  placeholder={`강점 ${index + 1} 입력`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 6: 나를 바꾼 결정 TOP 3
   */
  const renderSection6 = () => {
    const data = reviewData['6']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">6️⃣ 나를 바꾼 결정 TOP 3</h2>
        <p className="text-lg text-gray-600 mb-6 font-sans">결정 = 행동 + 책임</p>
        <div className="space-y-8">
          {data.decisions.map((decision, index) => (
            <div key={index} className="p-6 border-2 border-gray-200 rounded-lg">
              <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">{index + 1}️⃣ 결정:</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">결정 내용:</label>
                  <textarea
                    value={decision.decision}
                    onChange={(e) => {
                      const newDecisions = [...data.decisions]
                      newDecisions[index] = { ...newDecisions[index], decision: e.target.value }
                      saveReviewData({ ...reviewData, '6': { ...data, decisions: newDecisions } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">왜 이 결정을 했는가?</label>
                  <textarea
                    value={decision.why}
                    onChange={(e) => {
                      const newDecisions = [...data.decisions]
                      newDecisions[index] = { ...newDecisions[index], why: e.target.value }
                      saveReviewData({ ...reviewData, '6': { ...data, decisions: newDecisions } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">결과는 어땠는가?</label>
                  <textarea
                    value={decision.result}
                    onChange={(e) => {
                      const newDecisions = [...data.decisions]
                      newDecisions[index] = { ...newDecisions[index], result: e.target.value }
                      saveReviewData({ ...reviewData, '6': { ...data, decisions: newDecisions } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2 text-gray-600 font-sans">이 결정이 나에게 남긴 것:</label>
                  <textarea
                    value={decision.impact}
                    onChange={(e) => {
                      const newDecisions = [...data.decisions]
                      newDecisions[index] = { ...newDecisions[index], impact: e.target.value }
                      saveReviewData({ ...reviewData, '6': { ...data, decisions: newDecisions } })
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                    rows="2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /**
   * 섹션 7: 관계 & 환경 회고
   */
  const renderSection7 = () => {
    const data = reviewData['7']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">7️⃣ 관계 & 환경 회고</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 나에게 힘이 된 사람 / 환경</h3>
            <textarea
              value={data.helpful}
              onChange={(e) => saveReviewData({ ...reviewData, '7': { ...data, helpful: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="4"
            />
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 나를 소모시킨 관계 / 환경</h3>
            <textarea
              value={data.draining}
              onChange={(e) => saveReviewData({ ...reviewData, '7': { ...data, draining: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="4"
            />
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">2026년에 유지할 것 / 정리할 것</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">유지:</label>
                <textarea
                  value={data.maintain}
                  onChange={(e) => saveReviewData({ ...reviewData, '7': { ...data, maintain: e.target.value } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">정리:</label>
                <textarea
                  value={data.clean}
                  onChange={(e) => saveReviewData({ ...reviewData, '7': { ...data, clean: e.target.value } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 8: 올해 버린 것 & 새로 얻은 것
   */
  const renderSection8 = () => {
    const data = reviewData['8']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">8️⃣ 올해 버린 것 & 새로 얻은 것</h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 버린 것</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">사고방식:</label>
                <textarea
                  value={data.discarded.mindset}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, discarded: { ...data.discarded, mindset: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">관계:</label>
                <textarea
                  value={data.discarded.relationship}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, discarded: { ...data.discarded, relationship: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">기준:</label>
                <textarea
                  value={data.discarded.standard}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, discarded: { ...data.discarded, standard: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 얻은 것</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">역량:</label>
                <textarea
                  value={data.gained.capability}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, gained: { ...data.gained, capability: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">태도:</label>
                <textarea
                  value={data.gained.attitude}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, gained: { ...data.gained, attitude: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-lg mb-2 text-gray-600 font-sans">관점:</label>
                <textarea
                  value={data.gained.perspective}
                  onChange={(e) => saveReviewData({ ...reviewData, '8': { ...data, gained: { ...data.gained, perspective: e.target.value } } })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 9: 올해의 나를 한 문단으로 평가
   */
  const renderSection9 = () => {
    const data = reviewData['9']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">9️⃣ 올해의 나를 한 문단으로 평가한다면</h2>
        <p className="text-lg text-gray-600 mb-4 font-sans">객관적인 제3자의 시선으로 작성</p>
        <textarea
          value={data.evaluation}
          onChange={(e) => saveReviewData({ ...reviewData, '9': { ...data, evaluation: e.target.value } })}
          className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
          rows="6"
          placeholder='"올해의 나는 ______________________________"'
        />
      </div>
    )
  }

  /**
   * 섹션 10: 다음 해를 위한 인사이트 정리
   */
  const renderSection10 = () => {
    const data = reviewData['10']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">🔟 다음 해를 위한 인사이트 정리</h2>
        <div className="space-y-8">
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 올해가 나에게 가르쳐준 것 5가지</h3>
            {data.insights.map((insight, index) => (
              <div key={index} className="mb-4">
                <label className="block text-lg mb-2 text-gray-600 font-sans">{index + 1}번:</label>
                <textarea
                  value={insight}
                  onChange={(e) => {
                    const newInsights = [...data.insights]
                    newInsights[index] = e.target.value
                    saveReviewData({ ...reviewData, '10': { ...data, insights: newInsights } })
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-700 font-sans">✔ 내년에는 다르게 하고 싶은 것 3가지</h3>
            {data.different.map((item, index) => (
              <div key={index} className="mb-4">
                <label className="block text-lg mb-2 text-gray-600 font-sans">{index + 1}번:</label>
                <textarea
                  value={item}
                  onChange={(e) => {
                    const newDifferent = [...data.different]
                    newDifferent[index] = e.target.value
                    saveReviewData({ ...reviewData, '10': { ...data, different: newDifferent } })
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
                  rows="2"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 11: 다음 해를 위한 나의 기준 선언문
   */
  const renderSection11 = () => {
    const data = reviewData['11']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">1️⃣1️⃣ 다음 해를 위한 나의 기준 선언문</h2>
        <p className="text-xl font-semibold mb-6 text-gray-700 font-sans">2026년의 나는 이렇게 행동한다</p>
        <div className="space-y-6">
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">나는 _____________ 기준으로 선택한다.</label>
            <textarea
              value={data.criteria}
              onChange={(e) => saveReviewData({ ...reviewData, '11': { ...data, criteria: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">나는 _____________ 때문에 멈추지 않는다.</label>
            <textarea
              value={data.notStop}
              onChange={(e) => saveReviewData({ ...reviewData, '11': { ...data, notStop: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-xl mb-2 text-gray-700 font-sans">나는 _____________ 방식으로 성장한다.</label>
            <textarea
              value={data.growth}
              onChange={(e) => saveReviewData({ ...reviewData, '11': { ...data, growth: e.target.value } })}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
              rows="2"
            />
          </div>
        </div>
      </div>
    )
  }

  /**
   * 섹션 12: 연간 회고 마무리 문장
   */
  const renderSection12 = () => {
    const data = reviewData['12']
    return (
      <div className="mb-12 p-6 bg-white rounded-lg shadow-sm">
        <h2 className="text-4xl font-bold mb-6 text-gray-800 font-sans">1️⃣2️⃣ 연간 회고 마무리 문장</h2>
        <p className="text-lg text-gray-600 mb-4 font-sans">이 회고록을 덮으며 나에게 남기고 싶은 말</p>
        <textarea
          value={data.closing}
          onChange={(e) => saveReviewData({ ...reviewData, '12': { ...data, closing: e.target.value } })}
          className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-pink-400 focus:outline-none font-sans"
          rows="4"
          placeholder='"________________________________________"'
        />
      </div>
    )
  }

  /**
   * Day별 컨텐츠 렌더링
   */
  const renderDayContent = (day) => {
    const dayInfo = DAY_SECTIONS[day]
    if (!dayInfo) return null

    const sections = {
      '0': renderSection0,
      '1': renderSection1,
      '2': renderSection2,
      '3': renderSection3,
      '4': renderSection4,
      '5': renderSection5,
      '6': renderSection6,
      '7': renderSection7,
      '8': renderSection8,
      '9': renderSection9,
      '10': renderSection10,
      '11': renderSection11,
      '12': renderSection12,
    }

    return (
      <div className="mb-8">
        <div className="mb-6 p-4 bg-pink-50 rounded-lg border-2 border-pink-200">
          <h1 className="text-3xl font-bold mb-2 text-pink-700 font-sans">{dayInfo.title}</h1>
          <p className="text-lg text-gray-600 font-sans">{dayInfo.description}</p>
        </div>
        
        {dayInfo.sections.map((sectionNum) => {
          const renderFunc = sections[sectionNum]
          return renderFunc ? (
            <div key={sectionNum}>{renderFunc()}</div>
          ) : null
        })}

        {!completedDays.has(day) && (
          <div className="mt-8 text-center">
            <button
              onClick={() => handleDayComplete(day)}
              className="px-8 py-4 bg-pink-400 text-white text-xl font-semibold rounded-lg hover:bg-pink-500 transition-all duration-200 shadow-md hover:shadow-lg font-sans"
            >
              Day {day} 완료하기
            </button>
          </div>
        )}

        {completedDays.has(day) && (
          <div className="mt-8 text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-xl text-green-700 font-semibold mb-3 font-sans">✓ Day {day} 완료!</p>
            <p className="text-sm text-green-600 mb-3 font-sans">위의 내용을 수정하면 자동으로 저장됩니다.</p>
            <button
              onClick={() => {
                const newCompletedDays = new Set(completedDays)
                newCompletedDays.delete(day)
                setCompletedDays(newCompletedDays)
                const completedDaysArray = Array.from(newCompletedDays)
                saveReviewDataToDB(reviewData, completedDaysArray)
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-all duration-200 font-sans"
            >
              완료 취소
            </button>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-3xl text-gray-500 font-sans">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-5xl font-bold mb-4 text-gray-800 font-sans">📘 연간 회고록</h1>
        <p className="text-xl text-gray-600 font-sans">2025년을 돌아보고 2026년을 준비하는 시간</p>
      </div>

      {/* Day 네비게이션 - 모든 Day 표시 */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2 font-sans">진행 상황</h3>
            <p className="text-sm text-gray-500 font-sans">
              {completedDays.size > 0 
                ? `완료된 Day를 클릭하면 다시 볼 수 있고 수정할 수 있습니다. (${completedDays.size}/4 완료)`
                : 'Day를 완료하면 다음 Day가 자동으로 표시됩니다. 완료 후에도 언제든 수정 가능합니다.'}
            </p>
          </div>
          {isSaving && (
            <div className="text-sm text-gray-500 font-sans">저장 중...</div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4].map((day) => {
            const isCompleted = completedDays.has(day)
            const isCurrent = currentDay === day
            
            return (
              <button
                key={day}
                onClick={() => setCurrentDay(day)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 text-lg font-semibold font-sans ${
                  isCurrent
                    ? 'bg-pink-400 text-white shadow-md'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 border-2 border-gray-300'
                }`}
              >
                {isCompleted && '✓ '}
                {DAY_SECTIONS[day].title}
              </button>
            )
          })}
        </div>
      </div>

      {/* 현재 Day 컨텐츠 */}
      {renderDayContent(currentDay)}

      {/* 완료된 Day 안내 */}
      {completedDays.size > 0 && completedDays.size < 4 && (
        <div className="mt-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-lg text-blue-800 font-sans">
            💡 <strong>팁:</strong> 완료된 Day는 상단 네비게이션의 초록색 버튼을 클릭하면 다시 볼 수 있습니다.
          </p>
        </div>
      )}
    </div>
  )
}
