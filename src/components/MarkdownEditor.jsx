import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { uploadImage } from '../services/imageService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * Markdown 에디터 컴포넌트
 * @param {string} value - 초기 값
 * @param {Function} onChange - 변경 핸들러
 * @param {string} placeholder - placeholder 텍스트
 */
export default function MarkdownEditor({ value = '', onChange, placeholder = '' }) {
  const [isPreview, setIsPreview] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  /**
   * 이미지를 현재 커서 위치에 삽입하는 헬퍼 함수
   */
  const insertImageAtCursor = useCallback((imageUrl, fileName) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const imageMarkdown = `![${fileName || '이미지'}](${imageUrl})`
      const currentValue = value
      const newValue = currentValue.substring(0, start) + imageMarkdown + currentValue.substring(end)
      onChange?.(newValue)
      
      // 커서 위치 조정
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + imageMarkdown.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    } else {
      // textarea가 없으면 끝에 추가
      onChange?.(value + (value ? '\n\n' : '') + `![${fileName || '이미지'}](${imageUrl})`)
    }
  }, [value, onChange])

  /**
   * 이미지 업로드 핸들러
   */
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const imageUrl = await uploadImage(file)
      insertImageAtCursor(imageUrl, file.name)
    } catch (error) {
      showToast(error.message || '이미지 업로드에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUploading(false)
      // 파일 input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /**
   * 클립보드에서 이미지 붙여넣기 핸들러
   */
  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    // 클립보드에서 이미지 찾기
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault() // 기본 붙여넣기 동작 방지
        
        const file = item.getAsFile()
        if (!file) continue

        setIsUploading(true)
        try {
          const imageUrl = await uploadImage(file)
          const fileName = `붙여넣은 이미지-${Date.now()}`
          insertImageAtCursor(imageUrl, fileName)
        } catch (error) {
          showToast(error.message || '이미지 업로드에 실패했습니다.', TOAST_TYPES.ERROR)
        } finally {
          setIsUploading(false)
        }
        break
      }
    }
  }, [insertImageAtCursor])

  // textarea에 paste 이벤트 리스너 추가
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.addEventListener('paste', handlePaste)
      return () => {
        textarea.removeEventListener('paste', handlePaste)
      }
    }
  }, [handlePaste])

  return (
    <div className="border-2 border-pink-200 rounded-lg overflow-hidden bg-white">
      {/* 툴바 */}
      <div className="bg-pink-50 px-4 py-2 flex justify-between items-center border-b-2 border-pink-200">
        <span className="text-base text-gray-700 font-medium font-sans">Markdown</span>
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="image-upload"
            className={`text-base text-gray-700 hover:text-gray-900 px-3 py-1 rounded font-medium font-sans cursor-pointer ${
              isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pink-100'
            }`}
          >
            {isUploading ? '업로드 중...' : '📷 이미지'}
          </label>
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className="text-base text-gray-700 hover:text-gray-900 px-3 py-1 rounded font-medium font-sans"
          >
            {isPreview ? '편집' : '미리보기'}
          </button>
        </div>
      </div>

      {/* 에디터/뷰어 영역 */}
      <div className="grid grid-cols-2" style={{ gridTemplateColumns: isPreview ? '1fr' : '1fr 1fr' }}>
        {/* 에디터 */}
        <div className={isPreview ? 'hidden' : ''}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="w-full h-64 p-4 border-0 resize-none focus:outline-none font-mono text-base"
          />
        </div>

        {/* 미리보기 */}
        <div className={`${isPreview ? 'col-span-2' : ''} p-4 overflow-y-auto max-h-64 bg-white`}>
          {value ? (
            <div className="prose prose-base max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                  img({ node, ...props }) {
                    return (
                      <img
                        {...props}
                        className="max-w-full h-auto rounded-lg shadow-md my-4"
                        alt={props.alt || '이미지'}
                      />
                    )
                  },
                }}
              >
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-gray-400 text-base font-sans">{placeholder}</p>
          )}
        </div>
      </div>
    </div>
  )
}
