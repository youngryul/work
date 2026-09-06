import { useState, useEffect, useRef, useCallback } from 'react'
import { uploadImage } from '../../services/imageService.js'
import { updateNote } from '../../services/graduateService.js'

/**
 * 블록 타입 정의
 * h1, h2, paragraph, image, divider
 */
const BLOCK_TYPES = [
  { type: 'h1', label: '제목1 (H1)' },
  { type: 'h2', label: '제목2 (H2)' },
  { type: 'paragraph', label: '본문' },
  { type: 'image', label: '이미지' },
  { type: 'divider', label: '구분선' },
]

/** 카테고리 라벨 */
const CATEGORY_LABELS = {
  preview: '예습',
  lecture: '강의',
  review: '복습',
}

/**
 * 고유 블록 ID 생성
 */
function generateBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 새 블록 기본값 생성
 * @param {string} type
 */
function createBlock(type) {
  return { id: generateBlockId(), type, content: '' }
}

/**
 * textarea 높이 자동 조절
 */
function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * 대학원 기록 팝업 에디터 (노션 스타일 블록 에디터)
 * @param {{ note: Object, onClose: Function, onSaved: Function, onDelete: Function }} props
 */
export default function GraduateNoteModal({ note, onClose, onSaved, onDelete }) {
  const [title, setTitle] = useState('')
  const [noteDate, setNoteDate] = useState('')
  const [blocks, setBlocks] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [uploadingBlockId, setUploadingBlockId] = useState(null)
  const [addMenuOpenId, setAddMenuOpenId] = useState(null) // 블록 추가 메뉴 열린 블록 ID
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const saveTimerRef = useRef(null)
  const isInitRef = useRef(false)

  // note 변경 시 상태 초기화
  useEffect(() => {
    if (!note) return
    isInitRef.current = true
    setTitle(note.title ?? '')
    setNoteDate(note.note_date ?? new Date().toISOString().slice(0, 10))
    const loadedBlocks = Array.isArray(note.content) && note.content.length > 0
      ? note.content
      : [createBlock('paragraph')]
    setBlocks(loadedBlocks)
    setSavedAt(null)
    setConfirmingDelete(false)
  }, [note?.id])

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 자동 저장 (2초 debounce)
  const scheduleSave = useCallback((newTitle, newDate, newBlocks) => {
    if (isInitRef.current) {
      isInitRef.current = false
      return
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!note?.id) return
      try {
        setSaving(true)
        await updateNote(note.id, { title: newTitle, content: newBlocks, noteDate: newDate })
        setSavedAt(new Date())
        if (onSaved) onSaved({ id: note.id, title: newTitle, note_date: newDate, category: note.category })
      } catch (e) {
        console.error('자동 저장 실패:', e)
      } finally {
        setSaving(false)
      }
    }, 2000)
  }, [note?.id, note?.category, onSaved])

  // 클립보드 붙여넣기 이벤트 처리 (이미지)
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          const newBlock = createBlock('image')
          setUploadingBlockId(newBlock.id)
          setBlocks((prev) => {
            const updated = [...prev, newBlock]
            scheduleSave(title, noteDate, updated)
            return updated
          })
          try {
            const url = await uploadImage(file, 'graduate-notes')
            setBlocks((prev) => {
              const updated = prev.map((b) =>
                b.id === newBlock.id ? { ...b, content: url } : b
              )
              scheduleSave(title, noteDate, updated)
              return updated
            })
          } catch (err) {
            console.error('클립보드 이미지 업로드 실패:', err)
            setBlocks((prev) => prev.filter((b) => b.id !== newBlock.id))
          } finally {
            setUploadingBlockId(null)
          }
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [title, noteDate, scheduleSave])

  // 블록 내용 변경
  const handleBlockChange = (id, value) => {
    setBlocks((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, content: value } : b))
      scheduleSave(title, noteDate, updated)
      return updated
    })
  }

  // 블록 삭제
  const handleDeleteBlock = (id) => {
    setBlocks((prev) => {
      const updated = prev.filter((b) => b.id !== id)
      const final = updated.length === 0 ? [createBlock('paragraph')] : updated
      scheduleSave(title, noteDate, final)
      return final
    })
  }

  // 특정 블록 뒤에 새 블록 삽입
  const handleAddBlock = (afterId, type) => {
    setAddMenuOpenId(null)
    const newBlock = createBlock(type)
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId)
      const updated = [...prev]
      updated.splice(idx + 1, 0, newBlock)
      scheduleSave(title, noteDate, updated)
      return updated
    })
  }

  // 이미지 파일 업로드 (파일 선택)
  const handleImageUpload = async (blockId, file) => {
    if (!file) return
    setUploadingBlockId(blockId)
    try {
      const url = await uploadImage(file, 'graduate-notes')
      setBlocks((prev) => {
        const updated = prev.map((b) => (b.id === blockId ? { ...b, content: url } : b))
        scheduleSave(title, noteDate, updated)
        return updated
      })
    } catch (err) {
      console.error('이미지 업로드 실패:', err)
      alert(`이미지 업로드 실패: ${err.message}`)
    } finally {
      setUploadingBlockId(null)
    }
  }

  // 제목 변경
  const handleTitleChange = (value) => {
    setTitle(value)
    scheduleSave(value, noteDate, blocks)
  }

  // 날짜 변경
  const handleDateChange = (value) => {
    setNoteDate(value)
    scheduleSave(title, value, blocks)
  }

  if (!note) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 바 */}
        <div className="flex items-center gap-3 px-5 sm:px-6 py-3 border-b border-gray-100 shrink-0">
          {note.category && (
            <span className="text-xs font-medium text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2.5 py-1 shrink-0">
              {CATEGORY_LABELS[note.category] ?? note.category}
            </span>
          )}
          <input
            type="date"
            value={noteDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="text-sm text-gray-500 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300"
          />
          <span className="text-xs text-gray-400">
            {saving ? '저장 중...' : savedAt ? `저장됨 ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            {confirmingDelete ? (
              <>
                <button
                  onClick={() => onDelete?.()}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                >
                  삭제 확인
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                title="기록 삭제"
              >
                삭제
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 에디터 본문 */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
          {/* 제목 입력 */}
          <textarea
            placeholder="제목 없음"
            value={title}
            onChange={(e) => {
              autoResize(e.target)
              handleTitleChange(e.target.value)
            }}
            ref={(el) => el && autoResize(el)}
            rows={1}
            className="w-full text-2xl sm:text-3xl font-sans font-bold text-gray-900 placeholder-gray-300 resize-none border-none outline-none bg-transparent mb-4 leading-tight"
          />

          {/* 블록 목록 */}
          <div className="space-y-1">
            {blocks.map((block) => (
              <BlockRow
                key={block.id}
                block={block}
                isUploading={uploadingBlockId === block.id}
                addMenuOpen={addMenuOpenId === block.id}
                onAddMenuToggle={(id) => setAddMenuOpenId((prev) => (prev === id ? null : id))}
                onAddBlock={handleAddBlock}
                onDeleteBlock={handleDeleteBlock}
                onBlockChange={handleBlockChange}
                onImageUpload={handleImageUpload}
              />
            ))}
          </div>

          {/* 하단 여백 클릭 시 paragraph 추가 */}
          <div
            className="h-16 cursor-text"
            onClick={() => {
              const last = blocks[blocks.length - 1]
              if (!last || last.type !== 'paragraph' || last.content !== '') {
                const newBlock = createBlock('paragraph')
                setBlocks((prev) => {
                  const updated = [...prev, newBlock]
                  scheduleSave(title, noteDate, updated)
                  return updated
                })
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 블록 하나를 렌더링하는 행 컴포넌트
 */
function BlockRow({
  block,
  isUploading,
  addMenuOpen,
  onAddMenuToggle,
  onAddBlock,
  onDeleteBlock,
  onBlockChange,
  onImageUpload,
}) {
  const fileInputRef = useRef(null)

  return (
    <div className="group relative flex items-start gap-1">
      {/* 블록 추가(+) 버튼 */}
      <div className="relative shrink-0 mt-1">
        <button
          onClick={() => onAddMenuToggle(block.id)}
          className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
          title="블록 추가"
        >
          +
        </button>
        {/* 블록 타입 선택 드롭다운 */}
        {addMenuOpen && (
          <div className="absolute left-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                onClick={() => onAddBlock(block.id, bt.type)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {bt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 블록 본체 */}
      <div className="flex-1 min-w-0">
        <BlockContent
          block={block}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onBlockChange={onBlockChange}
          onImageUpload={onImageUpload}
        />
      </div>

      {/* 블록 삭제(×) 버튼 */}
      <button
        onClick={() => onDeleteBlock(block.id)}
        className="shrink-0 mt-1 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
        title="블록 삭제"
      >
        ×
      </button>
    </div>
  )
}

/**
 * 블록 타입별 콘텐츠 렌더링
 */
function BlockContent({ block, isUploading, fileInputRef, onBlockChange, onImageUpload }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current)
  }, [block.content])

  switch (block.type) {
    case 'h1':
      return (
        <textarea
          ref={textareaRef}
          placeholder="제목1"
          value={block.content}
          onChange={(e) => {
            autoResize(e.target)
            onBlockChange(block.id, e.target.value)
          }}
          rows={1}
          className="w-full text-2xl font-bold text-gray-800 placeholder-gray-300 resize-none border-none outline-none bg-transparent leading-tight py-0.5"
        />
      )

    case 'h2':
      return (
        <textarea
          ref={textareaRef}
          placeholder="제목2"
          value={block.content}
          onChange={(e) => {
            autoResize(e.target)
            onBlockChange(block.id, e.target.value)
          }}
          rows={1}
          className="w-full text-xl font-semibold text-gray-700 placeholder-gray-300 resize-none border-none outline-none bg-transparent leading-tight py-0.5"
        />
      )

    case 'paragraph':
      return (
        <textarea
          ref={textareaRef}
          placeholder="내용을 입력하세요..."
          value={block.content}
          onChange={(e) => {
            autoResize(e.target)
            onBlockChange(block.id, e.target.value)
          }}
          rows={1}
          className="w-full text-base text-gray-700 placeholder-gray-300 resize-none border-none outline-none bg-transparent leading-relaxed py-0.5"
        />
      )

    case 'image':
      return (
        <div className="py-1">
          {block.content ? (
            <div className="relative group/img">
              <img
                src={block.content}
                alt="첨부 이미지"
                className="max-w-full rounded-lg border border-gray-200"
              />
              {/* 이미지 교체 버튼 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                교체
              </button>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-8 cursor-pointer hover:border-sky-300 hover:bg-sky-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <span className="text-sm text-gray-500">업로드 중...</span>
              ) : (
                <>
                  <span className="text-2xl text-gray-300">🖼️</span>
                  <span className="text-sm text-gray-400">
                    클릭하여 이미지 업로드 또는 클립보드에서 붙여넣기
                  </span>
                </>
              )}
            </div>
          )}
          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImageUpload(block.id, file)
              e.target.value = ''
            }}
          />
        </div>
      )

    case 'divider':
      return <hr className="my-2 border-gray-200" />

    default:
      return null
  }
}
