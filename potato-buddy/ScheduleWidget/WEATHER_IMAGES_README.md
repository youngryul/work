# 날씨 위젯 이미지 교체 가이드

일정 위젯과 같은 크기(`systemSmall`)의 **현재 날씨** 위젯입니다.
아래 PNG를 원하는 일러스트로 **같은 파일명으로 덮어쓰기** 하면 됩니다.

## 이미지 넣는 위치

```
potato-buddy/ScheduleWidget/Assets.xcassets/
├── weather-clear.imageset/weather-clear.png
├── weather-partly-cloudy.imageset/weather-partly-cloudy.png
├── weather-cloudy.imageset/weather-cloudy.png
├── weather-rain.imageset/weather-rain.png
├── weather-snow.imageset/weather-snow.png
├── weather-thunderstorm.imageset/weather-thunderstorm.png
├── weather-fog.imageset/weather-fog.png
└── weather-default.imageset/weather-default.png
```

## 필요한 이미지 8장

| 에셋 이름 | 한글 | 언제 쓰이나 |
|-----------|------|-------------|
| `weather-clear` | 맑음 | 맑은 하늘 |
| `weather-partly-cloudy` | 구름 조금 | 약간 흐림 |
| `weather-cloudy` | 흐림 | 많이 흐림 / 흐린 하늘 |
| `weather-rain` | 비 | 비 · 이슬비 · 소나기 |
| `weather-snow` | 눈 | 눈 · 진눈깨비 |
| `weather-thunderstorm` | 뇌우 | 천둥번개 |
| `weather-fog` | 안개 | 안개 · 연무 |
| `weather-default` | 기본 | 알 수 없음 / 로드 실패용 |

## 권장 스펙

- 정사각 **512×512** 이상 (**1024×1024** 권장)
- **PNG** (투명 배경 가능, 위젯에서 화면을 꽉 채움)
- 왼쪽 위에 상태 글씨, 왼쪽 아래에 온도가 올라가므로 **대비**를 고려해 주세요

## 적용 방법

1. 위 경로의 PNG를 새 이미지로 교체
2. Xcode Clean Build 후 앱 설치
3. 홈 화면 길게 누르기 → 위젯 추가 → **「현재 날씨」**
