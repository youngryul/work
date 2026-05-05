#!/bin/bash
# 할일 완료 처리 헬퍼 스크립트
# SwiftBar에서 할일 항목 클릭 시 호출됩니다.

TASK_ID="$1"

if [ -z "$TASK_ID" ]; then
  echo "오류: task ID가 필요합니다." >&2
  exit 1
fi

CONFIG_FILE="$HOME/.config/work-widget/config"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "오류: 설정 파일을 찾을 수 없습니다." >&2
  exit 1
fi

source "$CONFIG_FILE"

# 현재 시각 (밀리초)
NOW=$(python3 -c "import time; print(int(time.time() * 1000))")

curl -sf -X PATCH \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"completed\": true, \"completedat\": $NOW}" \
  "${SUPABASE_URL}/rest/v1/tasks?id=eq.${TASK_ID}&user_id=eq.${USER_ID}" \
  > /dev/null 2>&1