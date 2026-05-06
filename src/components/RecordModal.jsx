import React from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { parseTextWithLinks } from '../utils/linkParser.js'

/**
 * 기록 상세 모달 컴포넌트
 * @param {Object} record - 기록 데이터
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러
 * @param {Function} onEdit - 수정 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 * @param {Function} onSetMain - 메인 기록 설정 핸들러
 * @param {Function} onUnsetMain - 메인 기록 해제 핸들러
 */
export default function RecordModal({ record, isOpen, onClose, onEdit, onDelete, onSetMain, onUnsetMain }) {
  if (!isOpen || !record) return null

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

  const content = record.content || record.background || ''
  const parsedLines = parseTextWithLinks(content)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-green-50 px-6 py-4 border-b-2 border-green-200 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base text-gray-600 font-sans">{record.projectName}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1 font-sans">{record.title}</h1>
            <p className="text-base text-gray-500 font-sans">{formatDate(record.date)}</p>
          </div>
          <div className="flex gap-2 ml-4 flex-wrap">
            {record.isMain ? (
              <button
                onClick={() => {
                  if (onUnsetMain) {
                    onUnsetMain(record.id)
                  }
                }}
                className="px-4 py-2 bg-yellow-400 text-white rounded-lg hover:bg-yellow-500 transition-colors text-base font-medium shadow-md font-sans"
              >
                📌 메인 해제
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onSetMain) {
                    onSetMain(record.id)
                  }
                }}
                className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors text-base font-medium shadow-md font-sans"
              >
                📌 메인 기록으로 설정
              </button>
            )}
            <button
              onClick={() => {
                onEdit?.(record)
                onClose()
              }}
              className="px-4 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans"
            >
              수정
            </button>
            <button
              onClick={() => {
                if (confirm('정말 삭제하시겠습니까?')) {
                  onDelete?.(record.id)
                  onClose()
                }
              }}
              className="px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors text-base font-medium shadow-md font-sans"
            >
              삭제
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-base font-medium font-sans"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {content && (
            <div className="text-gray-700 text-base font-sans whitespace-pre-wrap leading-relaxed">
              {parsedLines.map(({ lineIndex, parts }) => (
                <React.Fragment key={lineIndex}>
                  {parts.map((part, partIndex) => {
                    if (part.type === 'link') {
                      return (
                        <a
                          key={partIndex}
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {part.content}
                        </a>
                      )
                    }
                    return <span key={partIndex}>{part.content}</span>
                  })}
                  {lineIndex < parsedLines.length - 1 && '\n'}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
