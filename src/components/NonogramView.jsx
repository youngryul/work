import { useState, useEffect } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import { NONOGRAM_PUZZLES } from '../constants/nonogramPuzzles.js'
import { saveNonogramCompletion, isPuzzleCompleted } from '../services/nonogramService.js'

/**
 * 행 또는 열의 힌트를 계산하는 함수
 * @param {Array<boolean>} row - 행 또는 열의 boolean 배열
 * @returns {Array<number>} 힌트 배열 (빈 배열은 빈 힌트를 의미)
 */
function calculateHints(row) {
  const hints = []
  let count = 0
  
  for (let i = 0; i < row.length; i++) {
    if (row[i]) {
      count++
    } else {
      if (count > 0) {
        hints.push(count)
        count = 0
      }
    }
  }
  
  // 마지막에 남은 count가 있으면 추가
  if (count > 0) {
    hints.push(count)
  }
  
  // 빈 힌트는 빈 배열 반환 (0이 아닌)
  return hints
}

/**
 * 네모 로직 게임 뷰 컴포넌트
 */
export default function NonogramView() {
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  const [grid, setGrid] = useState([]) // null: 빈칸, true: 칠함, false: X 표시
  const [rowHints, setRowHints] = useState([])
  const [colHints, setColHints] = useState([])
  const [isCompleted, setIsCompleted] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawMode, setDrawMode] = useState(true) // true: 칠하기, false: X 표시
  const [completedPuzzles, setCompletedPuzzles] = useState(new Set()) // 완료한 퍼즐 ID 목록
  const [wrongCells, setWrongCells] = useState(new Set()) // 틀린 칸의 좌표 (row-col 형식)
  const [isLoadingCompletedPuzzles, setIsLoadingCompletedPuzzles] = useState(true) // 완료한 퍼즐 목록 로딩 중

  /**
   * 완료한 퍼즐 목록 로드
   */
  const loadCompletedPuzzles = async () => {
    setIsLoadingCompletedPuzzles(true)
    try {
      const completions = await Promise.all(
        NONOGRAM_PUZZLES.map(puzzle => 
          isPuzzleCompleted(puzzle.id).then(completed => ({ id: puzzle.id, completed }))
        )
      )
      const completedSet = new Set(
        completions.filter(c => c.completed).map(c => c.id)
      )
      setCompletedPuzzles(completedSet)
    } catch (error) {
      console.error('완료한 퍼즐 목록 로드 오류:', error)
    } finally {
      setIsLoadingCompletedPuzzles(false)
    }
  }

  /**
   * 로컬 스토리지에서 게임 상태 저장
   */
  const saveGameState = (puzzleId, currentGrid, currentDrawMode) => {
    try {
      const gameState = {
        puzzleId,
        grid: currentGrid,
        drawMode: currentDrawMode,
        timestamp: Date.now()
      }
      localStorage.setItem('nonogram_game_state', JSON.stringify(gameState))
    } catch (error) {
      console.error('게임 상태 저장 오류:', error)
    }
  }

  /**
   * 로컬 스토리지에서 게임 상태 복원
   */
  const loadGameState = (puzzleId) => {
    try {
      const savedState = localStorage.getItem('nonogram_game_state')
      if (!savedState) return null

      const gameState = JSON.parse(savedState)
      // 같은 퍼즐이고 24시간 이내의 저장된 상태만 복원
      if (gameState.puzzleId === puzzleId && Date.now() - gameState.timestamp < 24 * 60 * 60 * 1000) {
        return gameState
      }
      return null
    } catch (error) {
      console.error('게임 상태 복원 오류:', error)
      return null
    }
  }

  /**
   * 로컬 스토리지에서 게임 상태 삭제
   */
  const clearGameState = () => {
    try {
      localStorage.removeItem('nonogram_game_state')
    } catch (error) {
      console.error('게임 상태 삭제 오류:', error)
    }
  }

  /**
   * 퍼즐 초기화
   */
  const initializePuzzle = (puzzle, restoreFromStorage = true) => {
    // 먼저 저장된 상태 확인
    if (restoreFromStorage) {
      const savedState = loadGameState(puzzle.id)
      if (savedState) {
        setGrid(savedState.grid)
        setDrawMode(savedState.drawMode)
        setIsCompleted(false)
        setIsDrawing(false)
        setWrongCells(new Set())
        
        // 행 힌트 계산
        const rows = puzzle.solution.length
        const cols = puzzle.solution[0].length
        const newRowHints = puzzle.solution.map((row, rowIdx) => {
          const hints = calculateHints(row)
          return hints
        })
        setRowHints(newRowHints)
        
        // 열 힌트 계산
        const newColHints = []
        for (let col = 0; col < cols; col++) {
          const column = puzzle.solution.map(row => row[col])
          const hints = calculateHints(column)
          newColHints.push(hints)
        }
        setColHints(newColHints)
        return
      }
    }

    // 저장된 상태가 없으면 새로 시작
    const rows = puzzle.solution.length
    const cols = puzzle.solution[0].length
    
    // 빈 그리드 생성
    const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(null))
    setGrid(newGrid)
    
    // 행 힌트 계산
    const newRowHints = puzzle.solution.map((row, rowIdx) => {
      const hints = calculateHints(row)
      return hints
    })
    setRowHints(newRowHints)
    
    // 열 힌트 계산
    const newColHints = []
    for (let col = 0; col < cols; col++) {
      const column = puzzle.solution.map(row => row[col])
      const hints = calculateHints(column)
      newColHints.push(hints)
    }
    setColHints(newColHints)
    
    setIsCompleted(false)
    setIsDrawing(false) // 드래그 상태 초기화
    setWrongCells(new Set()) // 틀린 칸 초기화
  }

  /**
   * 퍼즐 선택
   */
  const handleSelectPuzzle = (puzzle) => {
    setSelectedPuzzle(puzzle)
    initializePuzzle(puzzle, true)
  }

  // 컴포넌트 마운트 시 완료한 퍼즐 목록 로드
  useEffect(() => {
    loadCompletedPuzzles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 게임 상태가 변경될 때마다 저장
  useEffect(() => {
    if (selectedPuzzle && grid.length > 0) {
      saveGameState(selectedPuzzle.id, grid, drawMode)
    }
  }, [grid, drawMode, selectedPuzzle])

  /**
   * 셀 상태 변경
   */
  const updateCell = (row, col, currentGrid) => {
    if (!selectedPuzzle || isCompleted) return currentGrid || grid
    
    const newGrid = currentGrid || grid.map(r => [...r])
    const solution = selectedPuzzle.solution
    const cellKey = `${row}-${col}`
    
    // 이전 상태 저장
    const previousValue = newGrid[row][col]
    
    if (newGrid[row][col] === null) {
      newGrid[row][col] = drawMode
    } else if (newGrid[row][col] === drawMode) {
      newGrid[row][col] = null
    } else {
      newGrid[row][col] = drawMode
    }
    
    // 칠하기 모드일 때만 틀린 칸 체크 (X 표시는 체크하지 않음)
    if (drawMode && newGrid[row][col] === true) {
      const solutionValue = solution[row][col]
      
      // 틀린 칸을 칠한 경우
      if (!solutionValue) {
        const newWrongCells = new Set(wrongCells)
        newWrongCells.add(cellKey)
        setWrongCells(newWrongCells)
        
        const wrongCount = newWrongCells.size
        showToast(`틀렸습니다! (틀린 개수: ${wrongCount}/3)`, TOAST_TYPES.ERROR)
        
        // 틀린 개수가 3개가 되면 실패 처리
        if (wrongCount >= 3) {
          setTimeout(() => {
            showToast('실패입니다! 새 퍼즐을 시작합니다.', TOAST_TYPES.ERROR)
            // 새 퍼즐 로드 (현재 퍼즐 재시작)
            initializePuzzle(selectedPuzzle)
          }, 1000)
          return newGrid
        }
      } else {
        // 맞는 칸을 칠한 경우, 틀린 칸 목록에서 제거 (이전에 틀렸다가 지운 경우)
        if (wrongCells.has(cellKey)) {
          const newWrongCells = new Set(wrongCells)
          newWrongCells.delete(cellKey)
          setWrongCells(newWrongCells)
        }
      }
    } else if (previousValue === true && newGrid[row][col] === null) {
      // 칠한 칸을 지운 경우, 틀린 칸 목록에서도 제거
      if (wrongCells.has(cellKey)) {
        const newWrongCells = new Set(wrongCells)
        newWrongCells.delete(cellKey)
        setWrongCells(newWrongCells)
      }
    }
    
    // 힌트 완료 체크 후 자동으로 빈칸에 X 표시
    autoMarkEmptyCells(newGrid)
    
    setGrid(newGrid)
    checkCompletion(newGrid)
    return newGrid
  }

  /**
   * 힌트가 완료된 행/열의 빈칸을 자동으로 X로 표시
   */
  const autoMarkEmptyCells = (currentGrid) => {
    if (!selectedPuzzle) return
    
    // 각 행 확인
    for (let rowIndex = 0; rowIndex < rowHints.length; rowIndex++) {
      // 현재 행의 힌트 계산
      const rowData = currentGrid[rowIndex] || []
      const currentRowHints = calculateHints(rowData.map(cell => cell === true))
      const targetRowHints = rowHints[rowIndex]
      
      // 행 힌트가 완료되었는지 확인
      if (isHintComplete(currentRowHints, targetRowHints)) {
        // 해당 행의 빈칸을 X로 표시
        for (let col = 0; col < currentGrid[rowIndex].length; col++) {
          if (currentGrid[rowIndex][col] === null) {
            currentGrid[rowIndex][col] = false
          }
        }
      }
    }
    
    // 각 열 확인
    for (let colIndex = 0; colIndex < colHints.length; colIndex++) {
      // 현재 열의 힌트 계산
      const column = currentGrid.map(row => row[colIndex])
      const currentColHints = calculateHints(column.map(cell => cell === true))
      const targetColHints = colHints[colIndex]
      
      // 열 힌트가 완료되었는지 확인
      if (isHintComplete(currentColHints, targetColHints)) {
        // 해당 열의 빈칸을 X로 표시
        for (let rowIndex = 0; rowIndex < currentGrid.length; rowIndex++) {
          if (currentGrid[rowIndex][colIndex] === null) {
            currentGrid[rowIndex][colIndex] = false
          }
        }
      }
    }
  }

  /**
   * 셀 클릭/드래그 핸들러 (onMouseDown에서 처리)
   */
  const handleCellMouseDown = (e, row, col) => {
    if (isCompleted || !selectedPuzzle) return
    
    // 클릭도 처리하고 드래그도 처리
    setIsDrawing(true)
    updateCell(row, col)
  }

  /**
   * 마우스 이동 핸들러
   */
  const handleCellMouseEnter = (row, col) => {
    if (!isDrawing || isCompleted || !selectedPuzzle) return
    
    const currentGrid = grid.map(r => [...r])
    
    // 이미 해당 모드로 설정되어 있으면 변경하지 않음
    if (currentGrid[row][col] === drawMode) return
    
    // updateCell 함수를 사용하여 틀린 개수 체크 등 모든 로직 실행
    updateCell(row, col, currentGrid)
  }

  /**
   * 마우스 업 핸들러
   */
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDrawing(false)
    }
    
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  /**
   * 완료 여부 확인
   */
  const checkCompletion = async (currentGrid) => {
    if (!selectedPuzzle) return
    
    const solution = selectedPuzzle.solution
    let isCorrect = true
    
    for (let row = 0; row < solution.length; row++) {
      for (let col = 0; col < solution[0].length; col++) {
        const cellValue = currentGrid[row][col]
        const solutionValue = solution[row][col]
        
        // 칠해야 하는 칸은 true, 아니면 null이어야 함
        if (solutionValue && cellValue !== true) {
          isCorrect = false
          break
        }
        if (!solutionValue && cellValue === true) {
          isCorrect = false
          break
        }
      }
      if (!isCorrect) break
    }
    
    if (isCorrect && !isCompleted) {
      setIsCompleted(true)
      showToast('축하합니다! 퍼즐을 완료했습니다! 🎉', TOAST_TYPES.SUCCESS)
      
      // 로컬 스토리지에서 게임 상태 삭제
      clearGameState()
      
      // Supabase에 완료 기록 저장
      if (selectedPuzzle) {
        try {
          await saveNonogramCompletion(
            selectedPuzzle.id,
            selectedPuzzle.name,
            selectedPuzzle.size
          )
          const newCompletedPuzzles = new Set([...completedPuzzles, selectedPuzzle.id])
          setCompletedPuzzles(newCompletedPuzzles)
          
          // 다음 미완료 퍼즐 찾기
          const currentIndex = NONOGRAM_PUZZLES.findIndex(p => p.id === selectedPuzzle.id)
          const nextPuzzle = NONOGRAM_PUZZLES.slice(currentIndex + 1).find(
            p => !newCompletedPuzzles.has(p.id)
          )
          
          // 다음 퍼즐이 있으면 2초 후 자동으로 로드
          if (nextPuzzle) {
            setTimeout(() => {
              handleSelectPuzzle(nextPuzzle)
              showToast(`다음 퍼즐: ${nextPuzzle.name}`, TOAST_TYPES.SUCCESS)
            }, 2000)
          }
        } catch (error) {
          console.error('완료 기록 저장 오류:', error)
        }
      }
    }
  }

  /**
   * 힌트 표시 (현재 상태와 비교)
   */
  const getCurrentRowHints = (rowIndex) => {
    const row = grid[rowIndex] || []
    return calculateHints(row.map(cell => cell === true))
  }

  const getCurrentColHints = (colIndex) => {
    const column = grid.map(row => row[colIndex])
    return calculateHints(column.map(cell => cell === true))
  }

  /**
   * 힌트가 완료되었는지 확인 (전체)
   */
  const isHintComplete = (currentHints, targetHints) => {
    if (currentHints.length !== targetHints.length) return false
    return currentHints.every((hint, i) => hint === targetHints[i])
  }

  /**
   * 개별 힌트가 완료되었는지 확인
   * 실제 그리드 상태를 분석하여 해당 힌트가 올바른 위치에서 완료되었는지 확인
   * @param {number} hintIndex - 확인할 힌트 인덱스
   * @param {Array<number>} currentHints - 현재 힌트 배열
   * @param {Array<number>} targetHints - 목표 힌트 배열
   * @param {Array} rowOrColumn - 행 또는 열의 실제 그리드 데이터 (null, true, false 배열)
   * @returns {boolean} 해당 힌트가 완료되었는지 여부
   */
  const isIndividualHintComplete = (hintIndex, currentHints, targetHints, rowOrColumn) => {
    // 힌트 인덱스가 범위를 벗어나면 false
    if (hintIndex >= targetHints.length) return false
    
    // 현재 힌트의 개수가 정확히 해당 인덱스+1개여야 함
    // 예: 목표가 [2, 4, 2]이고 현재가 [2]라면, 첫 번째 힌트는 완료가 아님 (아직 더 채워야 함)
    if (currentHints.length !== hintIndex + 1) return false
    
    // 해당 힌트까지의 모든 힌트가 일치해야 함
    for (let i = 0; i <= hintIndex; i++) {
      if (currentHints[i] !== targetHints[i]) {
        return false
      }
    }
    
    // 실제 그리드 상태를 분석하여 해당 힌트가 올바른 위치에서 완료되었는지 확인
    if (rowOrColumn) {
      let position = 0
      
      // 해당 힌트까지의 모든 힌트를 순회하며 위치 확인
      for (let i = 0; i <= hintIndex; i++) {
        const hintValue = targetHints[i]
        
        // 빈칸 건너뛰기
        while (position < rowOrColumn.length && rowOrColumn[position] !== true) {
          position++
        }
        
        // 해당 힌트만큼 연속된 칠해진 칸이 있는지 확인
        let count = 0
        while (position < rowOrColumn.length && rowOrColumn[position] === true) {
          count++
          position++
        }
        
        // 해당 힌트의 값과 일치하지 않으면 false
        if (count !== hintValue) {
          return false
        }
        
        // 마지막 힌트가 아니면 다음에 빈칸이 있어야 함
        if (i < hintIndex) {
          // 다음 힌트를 위해 빈칸이 있는지 확인 (X 표시도 가능)
          if (position < rowOrColumn.length && rowOrColumn[position] === true) {
            return false
          }
        }
      }
    }
    
    return true
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          네모 로직
        </h1>
        <p className="text-lg text-gray-500 mb-4">
          숫자 힌트를 보고 격자를 채워 그림을 완성하세요!
        </p>
      </div>

      {/* 퍼즐 선택 */}
      {!selectedPuzzle && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">퍼즐 선택</h2>
          {isLoadingCompletedPuzzles ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600 text-lg">완료 표기를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                // 완료되지 않은 퍼즐과 완료된 퍼즐 분리
                const incompletePuzzles = NONOGRAM_PUZZLES.filter(
                  puzzle => !completedPuzzles.has(puzzle.id)
                )
                const completedPuzzlesList = NONOGRAM_PUZZLES.filter(
                  puzzle => completedPuzzles.has(puzzle.id)
                )
                
                // 미완료 퍼즐 먼저, 완료된 퍼즐 나중에
                const sortedPuzzles = [...incompletePuzzles, ...completedPuzzlesList]
                
                return sortedPuzzles.map((puzzle) => {
                  const isCompleted = completedPuzzles.has(puzzle.id)
                  return (
                    <button
                      key={puzzle.id}
                      onClick={() => handleSelectPuzzle(puzzle)}
                      className={`p-4 border-2 rounded-lg transition-all text-left relative ${
                        isCompleted
                          ? 'border-green-400 bg-green-50 hover:bg-green-100 opacity-75'
                          : 'border-gray-200 hover:border-green-400 hover:bg-green-50'
                      }`}
                    >
                      {isCompleted && (
                        <div className="absolute top-2 right-2 text-green-600 text-xl">
                          ✓
                        </div>
                      )}
                      <div className={`font-bold text-lg mb-1 ${
                        isCompleted ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {puzzle.name}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        {puzzle.size} × {puzzle.size}
                      </div>
                      <div className="text-xs text-gray-400">
                        {puzzle.description}
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
          )}
        </div>
      )}

      {/* 게임 보드 */}
      {selectedPuzzle && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* 게임 정보 및 컨트롤 */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {selectedPuzzle.name}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedPuzzle.size} × {selectedPuzzle.size}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* 그리기 모드 토글 */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setDrawMode(true)}
                  className={`px-4 py-2 rounded transition-all ${
                    drawMode
                      ? 'bg-green-400 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  칠하기
                </button>
                <button
                  onClick={() => setDrawMode(false)}
                  className={`px-4 py-2 rounded transition-all ${
                    !drawMode
                      ? 'bg-gray-400 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  X 표시
                </button>
              </div>
              
              {/* 목록으로 버튼 */}
              <button
                onClick={() => {
                  setSelectedPuzzle(null)
                  setGrid([])
                  setIsCompleted(false)
                  setIsDrawing(false) // 드래그 상태 초기화
                  setWrongCells(new Set())
                }}
                className="px-4 py-2 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 transition-all"
              >
                목록으로
              </button>
            </div>
          </div>

          {/* 완료 메시지 */}
          {isCompleted && (
            <div className="mb-4 p-4 bg-green-100 border-2 border-green-400 rounded-lg text-center">
              <p className="text-xl font-bold text-green-800">
                🎉 완료했습니다! 🎉
              </p>
            </div>
          )}

          {/* 틀린 개수 표시 */}
          {selectedPuzzle && !isCompleted && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-300 rounded-lg text-center">
              <p className="text-lg font-bold text-red-700">
                틀린 개수: {wrongCells.size} / 3
              </p>
              {wrongCells.size >= 3 && (
                <p className="text-sm text-red-600 mt-1">
                  실패입니다! 새 퍼즐을 시작합니다.
                </p>
              )}
            </div>
          )}

          {/* 게임 보드 */}
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* 열 힌트 */}
              <div className="flex mb-2">
                <div className="w-20"></div>
                <div className="flex">
                  {colHints.map((hints, colIndex) => {
                    const maxHints = Math.max(...colHints.map(h => h.length), 1)
                    const currentHints = getCurrentColHints(colIndex)
                    return (
                      <div
                        key={colIndex}
                        className="w-10 flex flex-col items-center justify-end pb-1"
                        style={{ minHeight: `${maxHints * 20 + 20}px` }}
                      >
                        <div className="flex flex-col gap-0.5 items-center">
                          {hints.length === 0 ? (
                            <span className="text-xs text-gray-300">·</span>
                          ) : (
                            hints.map((hint, i) => {
                              // 한 열이 완료되었을 때만 힌트 완료 체크
                              const isColComplete = isHintComplete(currentHints, hints)
                              const isIndividualComplete = isCompleted || isColComplete
                              return (
                                <div
                                  key={i}
                                  className={`text-xs font-bold leading-none min-h-[14px] flex items-center justify-center ${
                                    isIndividualComplete
                                      ? 'text-green-600'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {hint}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 행 힌트와 그리드 */}
              <div className="flex">
                {/* 행 힌트 */}
                <div className="flex flex-col mr-2">
                  {rowHints.map((hints, rowIndex) => {
                    const currentHints = getCurrentRowHints(rowIndex)
                    return (
                      <div
                        key={rowIndex}
                        className="w-20 h-10 flex items-center justify-end pr-2"
                      >
                        <div className="flex gap-1">
                          {hints.length === 0 ? (
                            <span className="text-xs text-gray-300">·</span>
                          ) : (
                            hints.map((hint, i) => {
                              // 한 행이 완료되었을 때만 힌트 완료 체크
                              const isRowComplete = isHintComplete(currentHints, hints)
                              const isIndividualComplete = isCompleted || isRowComplete
                              return (
                                <span
                                  key={i}
                                  className={`text-xs font-bold ${
                                    isIndividualComplete
                                      ? 'text-green-600'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {hint}
                                </span>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 그리드 */}
                <div className="border-2 border-gray-800">
                  {grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      {row.map((cell, colIndex) => {
                        const cellKey = `${rowIndex}-${colIndex}`
                        const isWrong = wrongCells.has(cellKey)
                        return (
                          <button
                            key={colIndex}
                            onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                            className={`w-10 h-10 border border-gray-300 transition-all ${
                              isWrong
                                ? 'bg-red-500 hover:bg-red-600'
                                : cell === true
                                ? 'bg-green-500 hover:bg-green-600'
                                : cell === false
                                ? 'bg-gray-200 hover:bg-gray-300'
                                : 'bg-white hover:bg-gray-50'
                            } ${isCompleted ? 'cursor-default' : 'cursor-pointer'}`}
                            disabled={isCompleted}
                          >
                            {cell === false && (
                              <span className="text-gray-600 font-bold text-lg">×</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 도움말 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-2">게임 방법</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 행과 열의 숫자는 연속된 칠해진 칸의 개수를 나타냅니다</li>
              <li>• 왼쪽 클릭: 칠하기 / X 표시 (모드에 따라)</li>
              <li>• 드래그하여 여러 칸을 한 번에 칠할 수 있습니다</li>
              <li>• 힌트가 초록색이면 해당 행/열이 완료된 것입니다</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
