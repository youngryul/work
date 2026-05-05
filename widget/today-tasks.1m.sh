#!/bin/bash
# SwiftBar 플러그인: 오늘 할일 위젯
# <xbar.title>오늘 할일</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.refreshAfterEveryOpenForSeconds>60</xbar.refreshAfterEveryOpenForSeconds>

# ── 설정 파일 로드 ──────────────────────────────────────────
CONFIG_FILE="$HOME/.config/work-widget/config"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "⚠️ 설정 필요"
  echo "---"
  echo "위젯 초기 설정이 필요합니다."
  echo "자세한 내용은 widget/SETUP.md 를 참고하세요."
  exit 0
fi

source "$CONFIG_FILE"
# 필요 변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_ID, WEBSITE_URL

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPLETE_SCRIPT="$SCRIPT_DIR/complete-task.sh"

# ── 오늘 할일 조회 ──────────────────────────────────────────
RESPONSE=$(curl -sf \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "${SUPABASE_URL}/rest/v1/tasks?istoday=eq.true&completed=eq.false&user_id=eq.${USER_ID}&select=id,title,category,priority&order=priority.asc,movedtotodayat.asc,createdat.asc" \
  2>/dev/null)

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
  echo "⚠️ 연결 오류"
  echo "---"
  echo "Supabase 연결에 실패했습니다. 설정을 확인하세요."
  echo "🌐 웹사이트 열기 | href=$WEBSITE_URL"
  exit 0
fi

# ── 메뉴바 제목 ─────────────────────────────────────────────
COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")

if [ "$COUNT" = "0" ]; then
  echo "✅ 모두 완료"
else
  echo "☑ ${COUNT}개 남음"
fi

echo "---"

# ── 할일 목록 출력 ──────────────────────────────────────────
echo "$RESPONSE" | python3 - "$COMPLETE_SCRIPT" << 'PYEOF'
import sys, json

tasks = json.load(sys.stdin)
complete_script = sys.argv[1]

if not tasks:
    print("오늘 할일이 없습니다 🎉 | color=#888888")
else:
    for t in tasks:
        title = t["title"].replace("|", "-").replace("'", "'")
        task_id = t["id"]
        cat = t.get("category") or ""
        cat_prefix = f"[{cat}] " if cat and cat != "작업" else ""
        print(f"⬜ {cat_prefix}{title} | bash='{complete_script}' param1='{task_id}' terminal=false refresh=true")
PYEOF

# ── 하단 메뉴 ────────────────────────────────────────────────
echo "---"
echo "🌐 웹사이트 열기 | href=$WEBSITE_URL"
echo "🔄 새로고침 | refresh=true"