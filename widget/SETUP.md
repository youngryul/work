





# 맥북 위젯 설정 가이드

## 1. SwiftBar 설치

```bash
brew install swiftbar
```

또는 [SwiftBar 공식 사이트](https://swiftbar.app)에서 다운로드

## 2. 설정 파일 생성

```bash
mkdir -p ~/.config/work-widget
```

`~/.config/work-widget/config` 파일을 아래 내용으로 생성:

```bash
# Supabase 프로젝트 URL (VITE_SUPABASE_URL과 동일)
SUPABASE_URL="https://xxxxxxxx.supabase.co"

# Supabase Service Role Key (대시보드 > Settings > API > service_role)
SUPABASE_SERVICE_KEY="eyJhbGciOi..."

# 내 계정 User ID (아래 방법으로 확인)
USER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 웹사이트 URL
WEBSITE_URL="https://work-sable-one.vercel.app/"
```

### User ID 확인 방법
웹사이트에 로그인 후 브라우저 콘솔에서:
```javascript
(await supabase.auth.getUser()).data.user.id
```

## 3. 스크립트 실행 권한 부여

```bash
chmod +x /path/to/work/widget/today-tasks.1m.sh
chmod +x /path/to/work/widget/complete-task.sh
```

## 4. SwiftBar 플러그인 폴더에 연결

SwiftBar 실행 후 "Open Plugin Folder" 클릭, 또는:

```bash
# 플러그인 폴더 확인 후 심볼릭 링크 생성
PLUGIN_DIR="$HOME/Library/Application Support/SwiftBar/Plugins"
mkdir -p "$PLUGIN_DIR"

ln -s /path/to/work/widget/today-tasks.1m.sh "$PLUGIN_DIR/today-tasks.1m.sh"
ln -s /path/to/work/widget/complete-task.sh "$PLUGIN_DIR/complete-task.sh"
```

## 5. SwiftBar 재시작 또는 새로고침

메뉴바의 SwiftBar 아이콘 우클릭 > "Refresh All"

## 위젯 동작

| 동작 | 설명 |
|------|------|
| 메뉴바 아이콘 | 미완료 할일 개수 표시 (예: `☑ 3개 남음`) |
| 모두 완료 시 | `✅ 모두 완료` 표시 |
| 할일 항목 클릭 | 완료 처리 후 자동 갱신 |
| 🌐 웹사이트 열기 | 웹앱 바로가기 |
| 🔄 새로고침 | 수동 갱신 |
| 자동 갱신 주기 | 1분 |