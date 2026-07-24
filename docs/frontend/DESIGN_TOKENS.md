# Frontend Design Token Contract

## 목적과 적용 원칙

이 문서는 후속 UI 구현에서 사용할 디자인 토큰의 이름, 초기 값, 의미를 정의합니다. 현재 `globals.css`에 이 계약이 모두 적용됐다는 뜻이 아니며, 이번 문서 복구 작업은 CSS를 변경하지 않습니다.

- 기존 화면을 한 번에 바꾸지 않고 작은 PR에서 토큰을 단계적으로 적용합니다.
- 기존 selector의 값을 토큰으로 치환할 때 의도하지 않은 시각 변화가 없는지 확인합니다.
- 같은 상태의 의미를 화면마다 임의로 바꾸지 않습니다.
- 상태는 색상과 함께 텍스트, 아이콘 또는 설명으로 전달합니다.
- Light Mode를 우선하며 Dark Mode는 현재 Roadmap에서 제외합니다.
- 아래 초기 값은 현재 UI의 색상과 크기를 기준으로 한 출발점이며, 실제 적용 전 대비와 회귀를 다시 검증합니다.

## Color Tokens

```css
:root {
  --color-bg: #f3f5f7;
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-text: #172033;
  --color-text-muted: #627087;
  --color-border: #d8dee7;
  --color-border-strong: #aeb8c7;
  --color-primary: #2457d6;
  --color-primary-hover: #1845b8;
  --color-success: #18794e;
  --color-success-surface: #eaf8f1;
  --color-warning: #875d00;
  --color-warning-surface: #fff7df;
  --color-danger: #b42318;
  --color-danger-surface: #fff1f0;
  --color-info: #2457d6;
  --color-info-surface: #eef4ff;
}
```

| 토큰 | 의미 |
|---|---|
| `--color-bg` | 앱 전체 배경 |
| `--color-surface` | 카드, 폼, 패널 배경 |
| `--color-surface-muted` | 보조 패널과 약한 구분 영역 |
| `--color-text` | 기본 본문과 제목 |
| `--color-text-muted` | 설명, 보조 정보, 메타데이터 |
| `--color-border` | 기본 경계선 |
| `--color-border-strong` | 입력 필드와 강조 경계선 |
| `--color-primary` | 주요 Action과 Link |
| `--color-primary-hover` | 주요 Action hover |
| `--color-success` | 성공 상태 텍스트 |
| `--color-success-surface` | 성공 상태 배경 |
| `--color-warning` | 주의 상태 텍스트 |
| `--color-warning-surface` | 주의 상태 배경 |
| `--color-danger` | 차단, 오류, 회귀 상태 텍스트 |
| `--color-danger-surface` | 차단, 오류, 회귀 상태 배경 |
| `--color-info` | 갱신, 범위 확인, 안내 텍스트 |
| `--color-info-surface` | 갱신, 범위 확인, 안내 배경 |

## Spacing Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 56px;
  --space-9: 80px;
}
```

작은 간격은 control 내부와 inline 요소에 사용하고, 큰 간격은 section과 page 구분에 사용합니다. 토큰 적용 과정에서 기존 화면 밀도를 임의로 바꾸지 않습니다.

## Radius Tokens

```css
:root {
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-pill: 999px;
}
```

- `--radius-control`: Button, Input, 작은 안내 영역
- `--radius-card`: Card, Form, Detail Panel
- `--radius-pill`: Badge와 상태 Label

## Shadow Tokens

```css
:root {
  --shadow-panel: 0 8px 24px rgba(23, 32, 51, 0.05);
  --shadow-focus: 0 0 0 3px rgba(36, 87, 214, 0.3);
}
```

`--shadow-focus`는 키보드 focus를 분명히 표시하기 위한 계약입니다. Browser 기본 outline을 제거하고 그림자만 남기는 방식은 사용하지 않습니다.

## Typography Tokens

```css
:root {
  --font-size-xs: 0.78rem;
  --font-size-sm: 0.9rem;
  --font-size-body: 1rem;
  --font-size-lead: 1.125rem;
  --font-size-heading-sm: 1.2rem;
  --font-size-heading-md: 1.25rem;
  --font-size-heading-lg: 2rem;

  --line-height-compact: 1.25;
  --line-height-body: 1.5;
  --line-height-relaxed: 1.65;
}
```

큰 화면 제목의 반응형 크기는 `clamp()`를 유지할 수 있습니다. 토큰은 기본 크기 계약이며 모든 제목을 하나의 고정 크기로 강제하지 않습니다.

## Layout Tokens

```css
:root {
  --container-width: 1120px;
  --control-height: 44px;
}
```

- `--container-width`: 기본 앱 본문 최대 너비
- `--control-height`: Button과 주요 Form control의 최소 높이

### Breakpoint 계약

| 이름 | 값 | 기본 목적 |
|---|---:|---|
| small | 480px | 좁은 Mobile 화면 |
| medium | 768px | Tablet과 다단 Layout 전환 |
| large | 1024px | 넓은 Desktop Layout |

CSS Custom Property는 일반적인 media query 조건에 직접 사용할 수 없습니다. 따라서 breakpoint 값은 문서 계약으로 관리하고 `@media` 규칙에는 해당 값을 직접 기록합니다.

필수 수동 검토 폭은 1440px, 1024px, 768px, 390px입니다.

## Semantic Status

| 의미 | 상태 | 표현 원칙 |
|---|---|---|
| success | `PASS`, `COMPLETED`, `IMPROVED` | 성공 텍스트와 surface를 함께 사용 |
| warning | `DRAFT`, `RUNNING`, `FAIL` | 주의 텍스트와 다음 행동을 함께 표시 |
| danger | `BLOCK`, `ERROR`, `FAILED`, `REGRESSED` | 원인과 복구 또는 검토 Action을 함께 표시 |
| neutral | `INACTIVE`, `UNCHANGED`, 데이터 없음 | 중립 텍스트와 약한 surface 사용 |
| info | Refreshing, Scope 확인, 실행 안내 | 처리 중인 상태와 목적을 텍스트로 표시 |

개별 평가의 `FAIL`은 실행 자체의 `FAILED`와 구분합니다. `BLOCK`과 `REGRESSED`는 평균 수치보다 먼저 사용자가 인식할 수 있어야 합니다.

## 접근성

- Text와 Surface 조합은 실제 적용 시 WCAG contrast를 검증합니다.
- focus ring 토큰을 사용하고 키보드 focus를 숨기지 않습니다.
- 기존 reduced motion 대응을 유지합니다.
- 상태 Badge에는 사람이 읽을 수 있는 상태 텍스트를 포함합니다.
- 색상만으로 성공, 실패, 차단, 회귀를 구분하지 않습니다.
- Disabled control에는 가능한 경우 주변 텍스트로 이유를 제공합니다.
- 상태 갱신은 필요한 위치에서 `aria-live`를 사용합니다.
- Light Mode를 먼저 안정화하며 Dark Mode는 현재 범위에 포함하지 않습니다.
