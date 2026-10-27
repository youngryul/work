/**
 * Claude 연결 개인정보 고지 문구
 * backlog-mcp 서버가 실제로 다루는 데이터 기준으로 적는다 (도구가 바뀌면 함께 고칠 것).
 */
export const CLAUDE_CONNECTION_PRIVACY_ITEMS = [
  {
    title: 'Claude가 읽고 바꾸는 정보',
    body: '할 일의 제목·메모·카테고리·예정일·완료 여부와 카테고리 목록이에요. Claude는 할 일을 추가하고 메모를 고칠 수 있어요. 일기, 가계부, 일정 같은 다른 기록은 볼 수 없어요.',
  },
  {
    title: '정보가 전달되는 곳',
    body: 'Claude가 도구를 쓰면 위 정보가 대화에 담겨 Anthropic(Claude 운영사)으로 전달되고, Anthropic의 개인정보 처리방침에 따라 처리돼요.',
  },
  {
    title: '포실이가 저장하는 정보',
    body: '연결 키 원문은 저장하지 않아요. 키 이름, 키 앞부분, 발급·마지막 사용·폐기 시각과 사용 한도 계산용 횟수(2일 뒤 삭제)만 저장해요.',
  },
  {
    title: '연결 끊기',
    body: '키를 폐기하면 바로 끊겨요. 이미 Claude 대화에 들어간 내용은 claude.ai에서 그 대화를 지워야 사라져요.',
  },
]

/**
 * 개인정보 고지 박스
 * @param {{ compact?: boolean }} props compact 면 가이드 모달용 작은 글씨
 */
export default function ClaudeConnectionPrivacyNotice({ compact = false }) {
  return (
    <dl className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {CLAUDE_CONNECTION_PRIVACY_ITEMS.map((item) => (
        <div key={item.title}>
          <dt className="font-semibold text-gray-700">{item.title}</dt>
          <dd className="text-gray-600">{item.body}</dd>
        </div>
      ))}
    </dl>
  )
}
