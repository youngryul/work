# PotatoBuddy Android (MVP)

iOS `PotatoBuddyiOS`의 **Kotlin + Jetpack Compose** 포팅입니다.  
웹·iOS와 **동일한 Supabase** 백엔드를 사용합니다.

## MVP 범위

- 로그인 / 회원가입 (이메일 인증 후 로그인)
- 오늘 할일 (추가, 탭 시 취소선 후 3초 완료, 삭제)
- 백로그 (추가, 오늘로 이동, 삭제)
- 일기 (월별 목록, 작성/수정)
- 일정 (월 캘린더, 단순 CRUD · 반복 일정은 표시만/단순 저장)
- 설정 (로그아웃)

## 요구 사항

- Android Studio Ladybug(2024.2+) 또는 동급
- JDK 17
- Android SDK 35

## 열기 / 실행

1. Android Studio에서 `potato-buddy/PotatoBuddyAndroid` 폴더를 Open
2. Gradle Sync
3. 에뮬레이터 또는 실기기에서 Run (`app`)

명령줄 (SDK·JDK가 설정된 경우):

```bash
cd potato-buddy/PotatoBuddyAndroid
./gradlew :app:assembleDebug
```

Windows:

```bat
cd potato-buddy\PotatoBuddyAndroid
gradlew.bat :app:assembleDebug
```

> 처음 클론한 환경에서는 Android Studio가 Gradle Wrapper jar를 자동 생성합니다.  
> `gradlew`가 없다면 Android Studio로 한 번 연 뒤 다시 시도하세요.

## Supabase 설정

기본값은 iOS `Config.swift`와 동일하게 BuildConfig에 들어 있습니다.

오버라이드하려면 `PotatoBuddyAndroid/local.properties`에 추가:

```properties
sdk.dir=C\:\\Users\\YOU\\AppData\\Local\\Android\\Sdk
supabase.url=https://YOUR_PROJECT.supabase.co
supabase.anonKey=YOUR_ANON_KEY
```

## 교차 검증 체크리스트

웹 또는 iOS와 **같은 계정**으로 아래를 확인합니다.

1. [ ] 로그인 성공 / 잘못된 비밀번호 실패
2. [ ] 회원가입 후 이메일 인증 안내 표시
3. [ ] 오늘 할일 추가 → 웹/iOS에도 보임
4. [ ] 오늘 할일 탭 → 3초 후 완료 처리
5. [ ] 백로그 추가 → 오늘로 이동
6. [ ] 일기 저장 → 월 목록에 반영
7. [ ] 일정 추가/수정/삭제
8. [ ] 로그아웃 후 세션 제거 (재실행 시 로그인 화면)

## 이후 확장 (미포함)

타이머, 습관, 여행(+장소), 토익, 냉장고, 걸음, 시계, 위젯, 알림, 젤리 보상
