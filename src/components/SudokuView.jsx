import { useState, useEffect } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import { SUDOKU_PUZZLES } from '../constants/sudokuPuzzles.js'
import { saveSudokuCompletion, isPuzzleCompleted } from '../services/sudokuService.js'

/**
 * 스도쿠 게임 뷰 컴포넌트
 */
export default function SudokuView() {
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  const [grid, setGrid] = useState([]) // 현재 게임 상태 (0은 빈 칸, 1-9는 숫자)
  const [initialGrid, setInitialGrid] = useState([]) // 초기 퍼즐 (수정 불가능한 칸)
  const [selectedCell, setSelectedCell] = useState(null) // 선택된 셀 {row, col}
  const [isCompleted, setIsCompleted] = useState(false)
  const [completedPuzzles, setCompletedPuzzles] = useState(new Set()) // 완료한 퍼즐 ID 목록
  const [isLoadingCompletedPuzzles, setIsLoadingCompletedPuzzles] = useState(true)
  const [errors, setErrors] = useState(new Set()) // 오류가 있는 셀의 좌표 (row-col 형식)

  /**
   * 완료한 퍼즐 목록 로드
   */
  const loadCompletedPuzzles = async () => {
    setIsLoadingCompletedPuzzles(true)
    try {
      const completions = await Promise.all(
        SUDOKU_PUZZLES.map(puzzle => 
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
  const saveGameState = (puzzleId, currentGrid, currentInitialGrid, currentSelectedCell) => {
    try {
      const gameState = {
        puzzleId,
        grid: currentGrid,
        initialGrid: currentInitialGrid,
        selectedCell: currentSelectedCell,
        timestamp: Date.now()
      }
      localStorage.setItem('sudoku_game_state', JSON.stringify(gameState))
    } catch (error) {
      console.error('게임 상태 저장 오류:', error)
    }
  }

  /**
   * 로컬 스토리지에서 게임 상태 복원
   */
  const loadGameState = (puzzleId) => {
    try {
      const savedState = localStorage.getItem('sudoku_game_state')
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
      localStorage.removeItem('sudoku_game_state')
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
        setInitialGrid(savedState.initialGrid)
        setSelectedCell(savedState.selectedCell)
        setIsCompleted(false)
        setErrors(new Set())
        return
      }
    }

    // 저장된 상태가 없으면 새로 시작
    const puzzleGrid = puzzle.puzzle.map(row => [...row])
    const initial = puzzle.puzzle.map(row => row.map(cell => cell !== 0))
    
    setGrid(puzzleGrid)
    setInitialGrid(initial)
    setIsCompleted(false)
    setSelectedCell(null)
    setErrors(new Set())
  }

  /**
   * 퍼즐 선택
   */
  const handleSelectPuzzle = (puzzle) => {
    setSelectedPuzzle(puzzle)
    initializePuzzle(puzzle, true)
  }

  /**
   * 퍼즐 새로고침 (처음부터 다시 시작)
   */
  const handleRefreshPuzzle = () => {
    if (!selectedPuzzle) return
    clearGameState()
    initializePuzzle(selectedPuzzle, false)
    setSelectedCell(null)
    setErrors(new Set())
  }

  // 컴포넌트 마운트 시 완료한 퍼즐 목록 로드 및 저장된 게임 상태 복원
  useEffect(() => {
    loadCompletedPuzzles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 게임 상태가 변경될 때마다 저장
  useEffect(() => {
    if (selectedPuzzle && grid.length > 0 && initialGrid.length > 0) {
      saveGameState(selectedPuzzle.id, grid, initialGrid, selectedCell)
    }
  }, [grid, initialGrid, selectedCell, selectedPuzzle])

  /**
   * 셀 클릭 핸들러
   */
  const handleCellClick = (row, col) => {
    if (isCompleted || !selectedPuzzle) return
    if (initialGrid[row][col]) return // 초기 숫자는 수정 불가
    
    setSelectedCell({ row, col })
  }

  /**
   * 숫자 입력 핸들러
   */
  const handleNumberInput = (number) => {
    if (!selectedCell || isCompleted || !selectedPuzzle) return
    const { row, col } = selectedCell
    if (initialGrid[row][col]) return // 초기 숫자는 수정 불가
    
    const newGrid = grid.map(r => [...r])
    newGrid[row][col] = number === 0 ? 0 : number
    
    setGrid(newGrid)
    validateCell(row, col, newGrid)
    checkCompletion(newGrid)
  }

  /**
   * 셀 유효성 검사
   */
  const validateCell = (row, col, currentGrid) => {
    const value = currentGrid[row][col]
    const newErrors = new Set(errors)
    const cellKey = `${row}-${col}`
    
    if (value === 0) {
      // 빈 칸이면 해당 셀의 오류 제거
      newErrors.delete(cellKey)
      // 같은 행/열/박스의 다른 셀들도 다시 검사
      validateRelatedCells(row, col, currentGrid, newErrors)
      setErrors(newErrors)
      return
    }
    
    // 먼저 해당 셀과 관련된 모든 오류를 제거 (정답으로 수정했을 수 있으므로)
    newErrors.delete(cellKey)
    
    let hasError = false
    
    // 행 검사
    for (let c = 0; c < 9; c++) {
      if (c !== col && currentGrid[row][c] === value) {
        hasError = true
        newErrors.add(cellKey)
        newErrors.add(`${row}-${c}`)
      }
    }
    
    // 열 검사
    for (let r = 0; r < 9; r++) {
      if (r !== row && currentGrid[r][col] === value) {
        hasError = true
        newErrors.add(cellKey)
        newErrors.add(`${r}-${col}`)
      }
    }
    
    // 3x3 박스 검사
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (r !== row && c !== col && currentGrid[r][c] === value) {
          hasError = true
          newErrors.add(cellKey)
          newErrors.add(`${r}-${c}`)
        }
      }
    }
    
    // 같은 행/열/박스의 다른 셀들도 다시 검사 (정답으로 수정했을 수 있으므로)
    validateRelatedCells(row, col, currentGrid, newErrors)
    
    setErrors(newErrors)
  }

  /**
   * 관련된 셀들 재검사 (같은 행/열/박스)
   */
  const validateRelatedCells = (row, col, currentGrid, errorSet) => {
    const value = currentGrid[row][col]
    
    // 같은 행의 다른 셀들 검사
    for (let c = 0; c < 9; c++) {
      if (c !== col) {
        const cellValue = currentGrid[row][c]
        if (cellValue !== 0) {
          const cellKey = `${row}-${c}`
          // 먼저 오류 제거
          errorSet.delete(cellKey)
          
          // 중복 검사
          let hasDuplicate = false
          for (let c2 = 0; c2 < 9; c2++) {
            if (c2 !== c && currentGrid[row][c2] === cellValue) {
              hasDuplicate = true
              errorSet.add(cellKey)
              errorSet.add(`${row}-${c2}`)
            }
          }
          
          // 열 검사
          for (let r = 0; r < 9; r++) {
            if (r !== row && currentGrid[r][c] === cellValue) {
              hasDuplicate = true
              errorSet.add(cellKey)
              errorSet.add(`${r}-${c}`)
            }
          }
          
          // 박스 검사
          const boxRow = Math.floor(row / 3) * 3
          const boxCol = Math.floor(c / 3) * 3
          for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c2 = boxCol; c2 < boxCol + 3; c2++) {
              if ((r !== row || c2 !== c) && currentGrid[r][c2] === cellValue) {
                hasDuplicate = true
                errorSet.add(cellKey)
                errorSet.add(`${r}-${c2}`)
              }
            }
          }
        }
      }
    }
    
    // 같은 열의 다른 셀들 검사
    for (let r = 0; r < 9; r++) {
      if (r !== row) {
        const cellValue = currentGrid[r][col]
        if (cellValue !== 0) {
          const cellKey = `${r}-${col}`
          // 먼저 오류 제거
          errorSet.delete(cellKey)
          
          // 중복 검사
          for (let r2 = 0; r2 < 9; r2++) {
            if (r2 !== r && currentGrid[r2][col] === cellValue) {
              errorSet.add(cellKey)
              errorSet.add(`${r2}-${col}`)
            }
          }
          
          // 행 검사
          for (let c = 0; c < 9; c++) {
            if (c !== col && currentGrid[r][c] === cellValue) {
              errorSet.add(cellKey)
              errorSet.add(`${r}-${c}`)
            }
          }
          
          // 박스 검사
          const boxRow = Math.floor(r / 3) * 3
          const boxCol = Math.floor(col / 3) * 3
          for (let r2 = boxRow; r2 < boxRow + 3; r2++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
              if ((r2 !== r || c !== col) && currentGrid[r2][c] === cellValue) {
                errorSet.add(cellKey)
                errorSet.add(`${r2}-${c}`)
              }
            }
          }
        }
      }
    }
    
    // 같은 박스의 다른 셀들 검사
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (r !== row || c !== col) {
          const cellValue = currentGrid[r][c]
          if (cellValue !== 0) {
            const cellKey = `${r}-${c}`
            // 먼저 오류 제거
            errorSet.delete(cellKey)
            
            // 중복 검사
            // 행 검사
            for (let c2 = 0; c2 < 9; c2++) {
              if (c2 !== c && currentGrid[r][c2] === cellValue) {
                errorSet.add(cellKey)
                errorSet.add(`${r}-${c2}`)
              }
            }
            
            // 열 검사
            for (let r2 = 0; r2 < 9; r2++) {
              if (r2 !== r && currentGrid[r2][c] === cellValue) {
                errorSet.add(cellKey)
                errorSet.add(`${r2}-${c}`)
              }
            }
            
            // 박스 검사
            for (let r2 = boxRow; r2 < boxRow + 3; r2++) {
              for (let c2 = boxCol; c2 < boxCol + 3; c2++) {
                if ((r2 !== r || c2 !== c) && currentGrid[r2][c2] === cellValue) {
                  errorSet.add(cellKey)
                  errorSet.add(`${r2}-${c2}`)
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 전체 그리드 유효성 검사
   */
  const validateGrid = (currentGrid) => {
    const newErrors = new Set()
    
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = currentGrid[row][col]
        if (value === 0) continue
        
        // 행 검사
        for (let c = 0; c < 9; c++) {
          if (c !== col && currentGrid[row][c] === value) {
            newErrors.add(`${row}-${col}`)
            newErrors.add(`${row}-${c}`)
          }
        }
        
        // 열 검사
        for (let r = 0; r < 9; r++) {
          if (r !== row && currentGrid[r][col] === value) {
            newErrors.add(`${row}-${col}`)
            newErrors.add(`${r}-${col}`)
          }
        }
        
        // 3x3 박스 검사
        const boxRow = Math.floor(row / 3) * 3
        const boxCol = Math.floor(col / 3) * 3
        for (let r = boxRow; r < boxRow + 3; r++) {
          for (let c = boxCol; c < boxCol + 3; c++) {
            if (r !== row && c !== col && currentGrid[r][c] === value) {
              newErrors.add(`${row}-${col}`)
              newErrors.add(`${r}-${c}`)
            }
          }
        }
      }
    }
    
    setErrors(newErrors)
    return newErrors.size === 0
  }

  /**
   * 완료 여부 확인
   */
  const checkCompletion = async (currentGrid) => {
    if (!selectedPuzzle) return
    
    // 모든 칸이 채워졌는지 확인
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentGrid[row][col] === 0) {
          return
        }
      }
    }
    
    // 유효성 검사
    if (!validateGrid(currentGrid)) {
      return
    }
    
    // 솔루션과 비교
    const solution = selectedPuzzle.solution
    let isCorrect = true
    
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentGrid[row][col] !== solution[row][col]) {
          isCorrect = false
          break
        }
      }
      if (!isCorrect) break
    }
    
    if (isCorrect && !isCompleted) {
      setIsCompleted(true)
      showToast('축하합니다! 스도쿠를 완료했습니다! 🎉', TOAST_TYPES.SUCCESS)
      
      // 로컬 스토리지에서 게임 상태 삭제
      clearGameState()
      
      // Supabase에 완료 기록 저장
      if (selectedPuzzle) {
        try {
          await saveSudokuCompletion(
            selectedPuzzle.id,
            selectedPuzzle.name,
            selectedPuzzle.difficulty
          )
          const newCompletedPuzzles = new Set(completedPuzzles)
          newCompletedPuzzles.add(selectedPuzzle.id)
          setCompletedPuzzles(newCompletedPuzzles)
          
          // 다음 퍼즐로 자동 이동
          const currentIndex = SUDOKU_PUZZLES.findIndex(p => p.id === selectedPuzzle.id)
          if (currentIndex !== -1 && currentIndex < SUDOKU_PUZZLES.length - 1) {
            const nextPuzzle = SUDOKU_PUZZLES[currentIndex + 1]
            // 2초 후 다음 퍼즐로 이동
            setTimeout(() => {
              handleSelectPuzzle(nextPuzzle)
              showToast(`다음 퍼즐: ${nextPuzzle.name}`, TOAST_TYPES.INFO)
            }, 2000)
          } else {
            // 모든 퍼즐을 완료한 경우
            setTimeout(() => {
              showToast('모든 스도쿠를 완료했습니다! 🎊', TOAST_TYPES.SUCCESS)
              setSelectedPuzzle(null)
              setSelectedCell(null)
            }, 2000)
          }
        } catch (error) {
          console.error('완료 기록 저장 오류:', error)
        }
      }
    }
  }

  /**
   * 키보드 입력 핸들러
   */
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!selectedCell || isCompleted) return
      
      const key = e.key
      if (key >= '1' && key <= '9') {
        handleNumberInput(parseInt(key))
      } else if (key === '0' || key === 'Backspace' || key === 'Delete') {
        handleNumberInput(0)
      } else if (key === 'ArrowUp' && selectedCell.row > 0) {
        setSelectedCell({ row: selectedCell.row - 1, col: selectedCell.col })
      } else if (key === 'ArrowDown' && selectedCell.row < 8) {
        setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col })
      } else if (key === 'ArrowLeft' && selectedCell.col > 0) {
        setSelectedCell({ row: selectedCell.row, col: selectedCell.col - 1 })
      } else if (key === 'ArrowRight' && selectedCell.col < 8) {
        setSelectedCell({ row: selectedCell.row, col: selectedCell.col + 1 })
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedCell, isCompleted])

  /**
   * 난이도별 퍼즐 그룹화
   */
  const puzzlesByDifficulty = SUDOKU_PUZZLES.reduce((acc, puzzle) => {
    if (!acc[puzzle.difficulty]) {
      acc[puzzle.difficulty] = []
    }
    acc[puzzle.difficulty].push(puzzle)
    return acc
  }, {})

  const difficultyLabels = {
    easy: '쉬움',
    medium: '보통',
    hard: '어려움',
    expert: '전문가',
  }

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-orange-100 text-orange-800',
    expert: 'bg-red-100 text-red-800',
  }

  /**
   * 난이도를 별로 표시
   */
  const getDifficultyStars = (difficulty) => {
    const starCount = {
      easy: 1,
      medium: 2,
      hard: 3,
      expert: 4,
    }
    return '⭐'.repeat(starCount[difficulty] || 1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">스도쿠</h1>
      
      {!selectedPuzzle ? (
        // 퍼즐 선택 화면
        <div>
          {isLoadingCompletedPuzzles ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-600 text-lg">완료 표기를 불러오는 중...</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {(() => {
                  // 완료되지 않은 퍼즐과 완료된 퍼즐 분리
                  const incompletePuzzles = SUDOKU_PUZZLES.filter(
                    puzzle => !completedPuzzles.has(puzzle.id)
                  )
                  const completedPuzzlesList = SUDOKU_PUZZLES.filter(
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
                        className={`
                          aspect-square p-3 rounded-lg border-2 transition-all text-center relative flex flex-col items-center justify-center
                          ${isCompleted
                            ? 'bg-green-50 border-green-300 hover:border-green-400 opacity-75'
                            : 'bg-white border-gray-200 hover:border-blue-400'
                          }
                        `}
                      >
                        {isCompleted && (
                          <div className="absolute top-1 right-1 text-green-600 text-lg">
                            ✓
                          </div>
                        )}
                        <div className={`font-semibold text-base mb-1 ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>
                          {puzzle.name}
                        </div>
                        <div className="text-xs text-yellow-500">
                          {getDifficultyStars(puzzle.difficulty)}
                        </div>
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </div>
      ) : (
        // 게임 화면
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 스도쿠 그리드 */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{selectedPuzzle.name}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefreshPuzzle}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    title="퍼즐을 처음부터 다시 시작합니다"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    새로고침
                  </button>
                  <button
                    onClick={() => {
                      clearGameState()
                      setSelectedPuzzle(null)
                      setSelectedCell(null)
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors flex items-center gap-2"
                    title="퍼즐 목록으로 돌아갑니다"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    목록
                  </button>
                </div>
              </div>
              
              {/* 스도쿠 그리드 */}
              <div className="flex justify-center">
                <div className="grid grid-cols-9 gap-0 border-2 border-gray-800">
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const isInitial = initialGrid[rowIndex][colIndex]
                      const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                      const hasError = errors.has(`${rowIndex}-${colIndex}`)
                      const boxRow = Math.floor(rowIndex / 3)
                      const boxCol = Math.floor(colIndex / 3)
                      const isBoxBorderTop = rowIndex % 3 === 0
                      const isBoxBorderBottom = rowIndex % 3 === 2
                      const isBoxBorderLeft = colIndex % 3 === 0
                      const isBoxBorderRight = colIndex % 3 === 2
                      
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          className={`
                            w-12 h-12 flex items-center justify-center border border-gray-300 relative
                            ${isBoxBorderTop ? 'border-t-3 border-t-gray-900' : ''}
                            ${isBoxBorderBottom ? 'border-b-3 border-b-gray-900' : ''}
                            ${isBoxBorderLeft ? 'border-l-3 border-l-gray-900' : ''}
                            ${isBoxBorderRight ? 'border-r-3 border-r-gray-900' : ''}
                            ${isSelected ? 'bg-blue-300 ring-4 ring-blue-400 ring-inset z-10' : ''}
                            ${hasError ? 'bg-red-200' : ''}
                            ${isInitial ? 'bg-gray-100 font-bold' : 'bg-white cursor-pointer hover:bg-gray-50'}
                            ${isCompleted ? 'cursor-default' : 'cursor-pointer'}
                            transition-all duration-150
                          `}
                        >
                          {cell !== 0 ? (
                            <span className={`text-lg ${isInitial ? 'text-gray-800' : hasError ? 'text-red-600' : 'text-blue-600'}`}>
                              {cell}
                            </span>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              
              {/* 숫자 입력 패드 */}
              {!isCompleted && (
                <div className="mt-6 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumberInput(num)}
                      className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => handleNumberInput(0)}
                    className="w-12 h-12 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-lg transition-colors"
                  >
                    지우기
                  </button>
                </div>
              )}
              
              {isCompleted && (
                <div className="mt-6 text-center">
                  <p className="text-green-600 font-semibold text-lg">완료!</p>
                </div>
              )}
            </div>
          </div>
          
          {/* 힌트 및 정보 */}
          <div className="lg:w-64 space-y-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold text-gray-800 mb-2">게임 방법</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 각 행에 1-9 숫자가 한 번씩만 들어갑니다</li>
                <li>• 각 열에 1-9 숫자가 한 번씩만 들어갑니다</li>
                <li>• 각 3x3 박스에 1-9 숫자가 한 번씩만 들어갑니다</li>
                <li>• 키보드 화살표로 이동, 숫자 키로 입력</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
