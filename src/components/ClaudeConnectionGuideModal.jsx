import { useState, useEffect } from 'react'
import { MCP_SERVER_NAME } from '../services/mcpConnectionService.js'
import ClaudeConnectionPrivacyNotice from './ClaudeConnectionPrivacyNotice.jsx'

/** 가이드 탭 */
const GUIDE_TABS = [
  { id: 'claude-ai', label: 'claude.ai (웹·앱)' },
  { id: 'claude-code', label: 'Claude Code' },
]

/** 연결 후 써 볼 문장 */
const EXAMPLE_PROMPTS = [
  "방금 정리한 계획을 포실이 백로그에 '프로젝트' 카테고리로 넣어줘",
  '포실이 오늘 할 일 보여줘',
  "포실이 백로그에서 '여행' 관련 할 일 찾아서 메모에 준비물 목록을 덧붙여줘",
  '다음 주 월요일에 할 일로 "보고서 초안 쓰기" 넣어줘',
]

/** Claude가 쓸 수 있는 포실이 기능 */
const AVAILABLE_TOOLS = [
  '백로그에 할 일 추가 (한 번에 최대 30개, 카테고리·메모·예정일 포함)',
  '백로그·오늘 할 일 조회',
  '할 일 메모 덧붙이기·바꾸기',
  '카테고리 목록 조회',
]

/** 자주 겪는 문제 */
const TROUBLESHOOTING = [
  {
    problem: '“연결 키가 올바르지 않거나 폐기되었습니다”',
    solution: '키를 폐기했거나 일부만 복사된 경우예요. 새 키를 발급해서 다시 등록해 주세요.',
  },
  {
    problem: 'Claude가 포실이 도구를 안 써요',
    solution:
      'claude.ai는 대화 입력창 아래 도구 메뉴에서 포실이가 켜져 있는지 확인해 주세요. Claude Code는 /mcp 로 연결 상태를 볼 수 있어요. 문장에 “포실이”를 넣으면 더 잘 알아들어요.',
  },
  {
    problem: '“요청이 너무 많습니다”',
    solution: '키 하나당 1분에 30번까지 쓸 수 있어요. 잠시 후 다시 시도해 주세요.',
  },
  {
    problem: '“하루 300개까지 추가할 수 있습니다”',
    solution: '키 하나당 할 일은 하루 300개까지 추가돼요. 한국 시간 자정에 다시 채워져요.',
  },
  {
    problem: '키가 다른 사람에게 노출된 것 같아요',
    solution: '설정 › Claude 연결에서 그 키를 바로 폐기하고 새 키를 발급해 주세요. 폐기하면 즉시 막혀요.',
  },
]

/**
 * 번호 붙은 단계
 * @param {{ steps: import('react').ReactNode[] }} props
 */
function StepList({ steps }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</div>
        </li>
      ))}
    </ol>
  )
}

function ClaudeAiGuide() {
  return (
    <StepList
      steps={[
        <>
          포실이 <b>설정 › Claude 연결</b>에서 이름을 “claude.ai”로 적고 <b>새 키 발급</b>을 눌러요. 나오는{' '}
          <b>claude.ai 커넥터 URL</b>을 복사해요.
        </>,
        <>
          <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            claude.ai › 설정 › 커넥터
          </a>
          에서 <b>커스텀 커넥터 추가</b>를 눌러요.
        </>,
        <>
          이름은 “포실이”, <b>원격 MCP 서버 URL</b>에는 복사한 URL을 붙여 넣고 추가해요. 고급 설정의 OAuth 항목은 비워 두세요.
        </>,
        <>
          새 대화를 열고 입력창 아래 <b>도구 메뉴</b>에서 <b>포실이</b>를 켜요. 처음 도구를 쓸 때 Claude가 허용할지 물어보면 허용해 주세요.
        </>,
      ]}
    />
  )
}

function ClaudeCodeGuide() {
  return (
    <StepList
      steps={[
        <>
          포실이 <b>설정 › Claude 연결</b>에서 이름을 기기에 맞게 적고(예: “회사 노트북 Claude Code”) <b>새 키 발급</b>을 눌러요.
          나오는 <b>Claude Code 명령어</b>를 복사해요.
        </>,
        <>
          터미널에서 복사한 명령어를 실행해요. 어느 프로젝트 폴더에서 Claude Code를 열어도 포실이를 쓸 수 있게 등록돼요.
          예전에 등록한 포실이가 있으면 먼저{' '}
          <code className="px-1 bg-gray-100 rounded">claude mcp remove {MCP_SERVER_NAME}</code>로 지워요.
        </>,
        <>
          Claude Code에서 <code className="px-1 bg-gray-100 rounded">/mcp</code>를 입력해{' '}
          <code className="px-1 bg-gray-100 rounded">{MCP_SERVER_NAME}</code>가 연결됨으로 보이는지 확인해요.
        </>,
        <>
          키는 URL이 아니라 헤더로 저장돼서 설정 파일에는 서버 주소만 보여요. 그래도 명령어에 키가 들어 있으니 다른 사람에게 보내지 마세요.
        </>,
      ]}
    />
  )
}

/**
 * Claude 연결 가이드 모달 (claude.ai / Claude Code)
 * @param {{ isOpen: boolean, onClose: () => void, initialTab?: 'claude-ai'|'claude-code' }} props
 */
export default function ClaudeConnectionGuideModal({ isOpen, onClose, initialTab = 'claude-ai' }) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab)
  }, [isOpen, initialTab])

  // Esc 로 닫기
  useEffect(() => {
    if (!isOpen) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claude-guide-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <h2 id="claude-guide-title" className="text-xl font-bold text-gray-800">
            Claude에 포실이 연결하기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <div className="flex gap-2">
            {GUIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'claude-ai' ? <ClaudeAiGuide /> : <ClaudeCodeGuide />}

          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">이렇게 말해 보세요</h3>
            <ul className="space-y-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt} className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                  “{prompt}”
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Claude가 할 수 있는 일</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {AVAILABLE_TOOLS.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-2">할 일 삭제나 완료 처리는 아직 할 수 없어요.</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">개인정보는 이렇게 다뤄져요</h3>
            <ClaudeConnectionPrivacyNotice compact />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">잘 안 될 때</h3>
            <dl className="space-y-3">
              {TROUBLESHOOTING.map((item) => (
                <div key={item.problem}>
                  <dt className="text-sm font-semibold text-gray-700">{item.problem}</dt>
                  <dd className="text-sm text-gray-600">{item.solution}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
