# Frontend Line-height Contract

## 1. 조사 목적

이 문서는 Phase A3에서 현재 Frontend의 `line-height` 선언, Token, selector와 UI 역할을 실제 저장소 코드 기준으로 조사하고 후속 구현의 최소 계약을 결정한다.

이번 작업은 문서 계약 조사다. CSS 값, Token 선언, selector, React Component와 layout은 변경하지 않는다. 숫자가 비슷하다는 이유만으로 `1.4`, `1.5`, `1.6`, `1.65`를 하나의 scale로 정규화하지 않는다.

- 조사 기준 commit: `a2c8329`
- 조사 날짜: `2026-07-29`
- 소스 조사 상태: `PASS`
- Browser 검증: `NOT_VERIFIED`
- 자동 Pixel Diff: `NOT_PRESENT`

## 2. 조사 파일 범위

추적 파일 전체에서 `line-height`, `lineHeight`, `--line-height`, `--leading`과 관련 숫자·단위를 검색했다. 계약 판단에는 다음 파일을 직접 사용했다.

- `apps/web/src/app/globals.css`
- `apps/web/src/**/*.tsx`
- `docs/frontend/DESIGN_TOKENS.md`
- `docs/frontend/UI_UX_ROADMAP.md`
- `docs/frontend/SPACING_CONTRACT.md`

Backend, API, Database, Migration과 test에는 제품 line-height 선언이 없다.

## 3. 기존 Typography·Line-height Token

모든 기존 Token은 `apps/web/src/app/globals.css`의 `:root`에 선언돼 있다.

| Token | 값 | selector 참조 | 정확히 일치하는 현재 사용처 | 값은 같지만 역할이 다른 사용처 |
|---|---:|---|---|---|
| `--font-size-xs` | `0.78rem` | 있음 | `.eyebrow`, `.slug`, `.status-badge` | line-height Token 아님 |
| `--font-size-sm` | `0.9rem` | 있음 | `.count-label` | line-height Token 아님 |
| `--font-size-body` | `1rem` | 없음 | 없음 | body는 font-size와 line-height 모두 명시적으로 연결되지 않음 |
| `--font-size-lead` | `1.125rem` | 없음 | 없음 | `.summary-copy`는 literal `1.15rem`을 사용 |
| `--font-size-heading-sm` | `1.2rem` | 있음 | `h3` | heading line-height는 명시하지 않음 |
| `--font-size-heading-md` | `1.25rem` | 있음 | `h2` | heading line-height는 명시하지 않음 |
| `--font-size-heading-lg` | `2rem` | 없음 | `h1`은 `clamp()` 사용 | heading line-height는 명시하지 않음 |
| `--line-height-compact` | `1.25` | 없음 | 없음 | compact UI에 임의 적용할 근거 없음 |
| `--line-height-body` | `1.5` | 없음 | 없음 | body·description에 임의 적용하면 현재 computed 값이 바뀔 수 있음 |
| `--line-height-relaxed` | `1.65` | 있음 | `.page-description`, `.card-description`, `.state-panel p`, `.coming-next p` | `.summary-copy`의 `1.6`과 역할·값이 다름 |

`DESIGN_TOKENS.md`도 같은 세 line-height Token을 정의하고 `--line-height-relaxed`의 현재 selector 연결을 기록한다. 기존 문서는 `1.6`을 `1.5` 또는 `1.65`로 변경하지 말라고 명시한다.

## 4. 현재 line-height 선언 전체 목록

제품 CSS의 `line-height` property 선언은 두 개다.

| 파일 | selector | 선언 | 값 유형 | UI 역할 |
|---|---|---|---|---|
| `apps/web/src/app/globals.css` | `.page-description, .card-description, .state-panel p, .coming-next p` | `line-height: var(--line-height-relaxed)` | unitless Token 참조 | Description·상태 설명 |
| `apps/web/src/app/globals.css` | `.summary-copy` | `line-height: 1.6` | unitless literal | Summary copy |

Inline style, CSS Module, styled component, React `style={{ lineHeight: ... }}`, `--leading`, px·rem line-height 선언은 `NOT_PRESENT`다.

## 5. 값별 사용 빈도

빈도는 CSS Token 선언과 `line-height` property 선언을 구분한다. selector 묶음 한 선언은 property 선언 1회로 계산한다.

| 값 | Token 선언 | property 선언 | selector 수 | 상태 |
|---:|---:|---:|---:|---|
| `1.25` | 1 | 0 | 0 | 선언만 존재 |
| `1.5` | 1 | 0 | 0 | 선언만 존재 |
| `1.6` | 0 | 1 | 1 | literal 사용 |
| `1.65` | 1 | 1 | 4 | 기존 Token 연결 |
| `1.4` | 0 | 0 | 0 | `NOT_PRESENT` |
| 기타 unitless literal | 0 | 0 | 0 | `NOT_PRESENT` |
| px line-height | 0 | 0 | 0 | `NOT_PRESENT` |
| rem line-height | 0 | 0 | 0 | `NOT_PRESENT` |
| 명시적 `normal` | 0 | 0 | 0 | `NOT_PRESENT` |

명시적 선언이 없는 요소는 CSS 초기값과 상속에 따라 computed `normal` 또는 상위 값을 사용할 수 있다. 이는 소스의 명시적 `normal` 선언으로 세지 않는다.

## 6. 파일과 selector·component 문맥

### `--line-height-relaxed: 1.65`

- `.page-description`: Projects와 각 상세 Route의 page header 설명
- `.card-description`: Project, Dataset, Target 등 Card 설명
- `.state-panel p`: `AsyncStates`와 Route별 loading·empty·error 상태 설명
- `.coming-next p`: CSS selector는 있으나 우선 Route의 React 사용처는 `NOT_PRESENT`

### Literal `1.6`

- `.summary-copy`: Project Overview의 summary report 본문
- 대표 component: `apps/web/src/app/projects/[projectId]/project-detail-client.tsx`
- 역할: 일반 description이 아니라 강조된 다중 행 요약 문장

## 7. Unit 분류

| 분류 | 값 | 상태 | 판단 |
|---|---|---|---|
| Unitless | `1.25`, `1.5`, `1.6`, `1.65` | `PASS` | font-size에 비례하며 현재 계약의 유일한 형식 |
| px | 없음 | `NOT_PRESENT` | 고정 line box를 도입할 근거 없음 |
| rem | 없음 | `NOT_PRESENT` | root font-size 기반 line-height를 도입할 근거 없음 |
| `normal` 명시 | 없음 | `NOT_PRESENT` | 다수 요소는 명시하지 않아 Browser 초기값·상속 사용 |

후속 구현도 현재 값을 보존하기 위해 unitless 형식을 유지한다.

## 8. UI 역할별 분류

| UI 역할 | 현재 명시값 | 근거 selector | 상태 |
|---|---:|---|---|
| Body copy | 명시 없음 | `body`, 일반 `p` | 상속·초기값 유지 |
| Page title | 명시 없음 | `h1` | font-size만 명시 |
| Section title | 명시 없음 | `h2` | font-size만 Token 연결 |
| Card title | 명시 없음 | `h3` | font-size만 Token 연결 |
| Summary copy | `1.6` | `.summary-copy` | literal |
| Description copy | `1.65` | `.page-description`, `.card-description` | 기존 Token |
| Form label | 명시 없음 | `label` | 상속·초기값 유지 |
| Form helper text | 명시 없음 | `label small`, `.field-error` | 상속·초기값 유지 |
| Error message | 명시 없음 | `.form-error`, `.download-error`, `.metadata-error` | 상속·초기값 유지 |
| Notice message | 명시 없음 | `.notice`, `.refreshing` | 상속·초기값 유지 |
| Metadata | 명시 없음 | `dt`, `.count-label`, `.card-meta`, `.detail-list` | 상속·초기값 유지 |
| Badge text | 명시 없음 | `.status-badge`, `.semantic-badge` | 상속·초기값 유지 |
| Button text | 명시 없음 | `.button`, `.text-button` | control font 상속 |
| Pagination text | 명시 없음 | `.pagination`, `.compact-pagination` | Button 계약 상속 |
| Navigation·Breadcrumb | 명시 없음 | `.breadcrumb` | 상속·초기값 유지 |
| Table text | 없음 | Table UI | `NOT_PRESENT` |
| Modal·dialog text | 없음 | Modal·dialog UI | `NOT_PRESENT` |
| Compact UI text | 명시 없음 | compact list·pagination·metadata | `--line-height-compact` 미사용 |
| Loading state text | `1.65` 또는 명시 없음 | `.state-panel p`, heading·Button | 설명 문장만 relaxed |
| Code·monospace text | 명시 없음 | `code`, `.snapshot-value` | font-family만 명시 |
| Mobile text layout | 별도 값 없음 | `@media (max-width: 720px)` | desktop line-height 유지 |

## 9. `1.6` 계약

`1.6`은 `.summary-copy` 한 selector에서만 사용한다. Summary는 `font-size: 1.15rem`, `font-weight: 700`인 강조된 다중 행 본문이며 일반 Body나 Notice와 다른 역할이다.

- 결정: **C. 신규 역할 기반 Token 선언**
- 제안 이름은 `--line-height-summary`이며 계약값은 `1.6`이다.
- 허용 참조: `.summary-copy`만
- 값 변경: 없음
- `--line-height-body: 1.5` 또는 `--line-height-relaxed: 1.65`로 통합: 금지

한 사용처뿐이지만 `DESIGN_TOKENS.md`가 별도 판단 대상으로 명시했고, Summary의 역할과 값이 모두 기존 Token과 다르므로 semantic 계약을 고정할 근거가 있다.

## 10. `1.5` 계약

`1.5`는 `--line-height-body` 선언에만 존재하고 selector 참조는 없다. `body`에도 명시적 `line-height`가 없다.

- 결정: **A. 현재 선언 유지**
- selector 연결: 이번 후속 구현에서 하지 않음
- Body, Description, control에 적용: 금지
- 이유: 적용 시 Browser의 `normal` 또는 기존 `1.65` computed line-height가 바뀌고 전체 text wrapping과 component 높이에 영향을 줄 수 있음

## 11. `1.4` 계약

제품 CSS와 Token에서 `1.4`는 `NOT_PRESENT`다. Metadata, helper, compact text에도 명시적 `1.4` 사용 근거가 없다.

- 결정: **A. 부재 유지**
- 신규 Token 또는 selector 연결: 금지
- `1.25`, `1.5`와 통합 검토: 근거 없음

## 12. 기타 예외값 계약

### `1.65`

`--line-height-relaxed`는 Description과 상태 설명 selector 묶음에 이미 연결돼 있다.

- 결정: **B. 기존 Token 연결 유지**
- selector 추가·삭제: 없음
- `1.6`과 통합: 금지

### `1.25`

`--line-height-compact`는 선언만 있고 참조가 없다.

- 결정: **A. 현재 선언 유지**
- Button, Badge, Metadata, compact pagination에 적용: 근거가 생기기 전까지 금지

### Heading·Button·Badge·normal 상속

Heading, Button, Badge, label, helper, error, notice, metadata 대부분은 line-height를 명시하지 않는다.

- 결정: **A. 기존 상속·초기값 유지**
- `--line-height-compact`, `--line-height-body` 일괄 적용: 금지
- px 단위 line-height 추가: 금지

## 13. 같은 값과 같은 역할·다른 역할

- 같은 역할·같은 값: Description 계열 네 selector는 `1.65` Token 묶음을 유지한다.
- 같은 역할·다른 값: 현재 명시적 사례가 없어 `NOT_PRESENT`다.
- 다른 역할·비슷한 값: Summary `1.6`과 Description `1.65`는 수치가 가깝지만 역할과 typography가 다르므로 분리한다.
- 선언만 존재하는 값: Body `1.5`와 compact `1.25`는 이름만으로 selector 역할을 추정해 적용하지 않는다.

## 14. Typography scale과의 관계

Line-height는 font-size Token과 독립적으로 조사한다.

- `h1`: responsive `clamp()` font-size, line-height 명시 없음
- `h2`, `h3`: heading font-size Token 사용, line-height 명시 없음
- Description: selector별 font-size가 상속되지만 line-height는 relaxed `1.65`
- Summary: literal `1.15rem`, bold, line-height `1.6`
- Caption·Metadata·Badge: 작은 font-size를 사용해도 compact line-height를 자동 적용하지 않음
- Control: `font: inherit`와 높이 계약을 사용하며 line-height를 새로 고정하지 않음

값만 보고 font-size와 line-height Token을 짝짓지 않는다.

## 15. Responsive line-height 계약

현재 mobile media query에는 line-height override가 없다.

- Desktop과 mobile의 명시 line-height 값은 동일하게 유지한다.
- Mobile에서는 폭 감소로 text wrapping, Card·Panel 높이와 세로 overflow가 달라질 수 있다.
- mobile 전용 line-height를 근거 없이 추가하지 않는다.
- 후속 구현에서 `1.6`을 Token으로 치환하더라도 `390px`에서 Summary wrapping과 높이를 별도로 검증한다.

## 16. 후보 A~F 비교

| 후보 | 장점 | 위험 | Wrapping·높이 영향 | 구현 범위 | 판단 |
|---|---|---|---|---|---|
| A. literal 전부 유지 | 변경 없음 | `1.6` semantic 계약이 계속 literal에 머묾 | 없음 | 없음 | 일부 채택 |
| B. 정확히 일치하는 기존 Token만 연결 | 기존 체계 재사용 | `1.6`과 일치하는 Token이 없음 | 값 보존 시 없음 | 현재 연결 유지 | 채택 |
| C. 역할별 신규 Token 추가, 값 유지 | Summary 역할과 예외값을 명시 | 단일 사용처 Token 증가 | 값 보존 목표이나 Browser 확인 필요 | Token 1개와 selector 1개 | 채택 |
| D. `1.4`·`1.5`·`1.6` scale 정규화 | 숫자 체계 단순화 | 근거 없는 wrapping·높이 변경 | 큼 | 광범위 | 기각 |
| E. 대표 공통값만 Token화하고 예외 유지 | 역할 경계를 보존 | 일부 미사용 Token 유지 | 최소 | 제한적 | 최종 전략 |
| F. 결정 불가 | 성급한 변경 방지 | 실제 코드와 문서 근거가 충분한 `1.6` 결정을 미룸 | 없음 | 없음 | 기각 |

최종 선택은 **E**다. 기존 `1.65` 연결은 유지하고, Summary `1.6`만 역할 기반 Token으로 분리하며, `1.25`, `1.5`와 명시되지 않은 요소는 현 상태를 유지한다.

## 17. 최종 계약

| UI 역할 | 현재 값 | 계약 값 | Token 여부 | 변경 여부 | 근거 |
|---|---:|---:|---|---|---|
| Body copy | 명시 없음 | 현 상속·초기값 | `--line-height-body` 미연결 | 없음 | 적용 시 전체 wrapping 변경 |
| Page title | 명시 없음 | 현 상속·초기값 | 없음 | 없음 | heading 값 결정 근거 없음 |
| Section title | 명시 없음 | 현 상속·초기값 | 없음 | 없음 | heading 값 결정 근거 없음 |
| Card title | 명시 없음 | 현 상속·초기값 | 없음 | 없음 | heading 값 결정 근거 없음 |
| Summary copy | `1.6` | `1.6` | 신규 `--line-height-summary` | 값 변경 없음 | 고유 역할과 문서상 예외 |
| Description | `1.65` | `1.65` | 기존 `--line-height-relaxed` | 없음 | 이미 정확히 연결됨 |
| Helper text | 명시 없음 | 현 상속·초기값 | compact·body 미연결 | 없음 | 역할별 측정 근거 없음 |
| Error·Notice | 명시 없음 | 현 상속·초기값 | 없음 | 없음 | surface와 text 역할이 다양함 |
| Badge | 명시 없음 | 현 상속·초기값 | compact 미연결 | 없음 | vertical alignment 변경 위험 |
| Button | 명시 없음 | 현 상속·초기값 | compact·body 미연결 | 없음 | control height와 정렬 변경 위험 |
| Metadata | 명시 없음 | 현 상속·초기값 | compact 미연결 | 없음 | 작은 font-size만으로 통합 불가 |
| Table text | `NOT_PRESENT` | `NOT_PRESENT` | `NOT_PRESENT` | 없음 | UI 없음 |
| Modal·dialog text | `NOT_PRESENT` | `NOT_PRESENT` | `NOT_PRESENT` | 없음 | UI 없음 |

## 18. 확인된 사실

- line-height Token은 `1.25`, `1.5`, `1.65` 세 개다.
- 실제 `line-height` property 선언은 두 개다.
- 기존 Token 참조는 `--line-height-relaxed` 한 개다.
- literal line-height는 `.summary-copy`의 `1.6` 한 개다.
- `1.4`, px, rem, 명시적 `normal`, inline `lineHeight`는 없다.
- mobile override는 없다.
- `.coming-next p`는 CSS selector에 포함되지만 조사한 추적 React 파일 범위에서는 사용처를 확인하지 못함 (`NOT_PRESENT`).

## 19. 추론

- Summary와 Description은 모두 다중 행 문장이지만 font-size, weight, 위치와 역할이 다르다.
- 값이 가까워도 `1.6`을 `1.65`로 바꾸면 line box와 Card·Panel 높이가 달라질 수 있다.
- Body·compact Token 이름만으로 현재 명시되지 않은 selector에 적용할 수 없다.
- 값 보존 치환도 실제 Browser visual 동일성의 증거는 아니다.

## 20. 미검증

- 모든 selector의 현재 Browser computed `normal` 값
- `1.6` Token 치환 전후 computed line-height
- Summary의 desktop·mobile wrapping과 높이
- Description·Summary를 함께 포함한 Card·Panel 높이
- Button·Badge 수직 정렬
- 가로·세로 overflow
- Focus outline clipping
- Browser Console 오류
- 자동 Pixel Diff

## 21. Browser 검증 계획

후속 구현 PR에서 다음 환경을 사용한다.

- Chrome headed mode
- Zoom 100%
- Device scale 1
- Route: `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail
- Viewport: `1440px`, `1024px`, `768px`, `390px`

검증 항목:

- `.summary-copy`의 computed line-height `1.6` 대응값
- Description의 기존 `1.65` 유지
- Text wrapping과 heading·body·summary 높이
- Helper·Error·Notice 높이
- Button·Badge 수직 정렬
- Card·Panel과 Form field 높이
- Pagination 정렬
- mobile text wrapping
- 가로·세로 overflow
- Focus outline clipping
- Console 오류

구현 전에는 Browser 결과나 visual 동일성을 `PASS`로 기록하지 않는다.

## 22. 후속 구현 PR 최소 범위

허용하는 최소 구현 묶음:

1. `:root`에 `--line-height-summary: 1.6`을 선언한다.
2. `.summary-copy`의 `line-height: 1.6`만 `line-height: var(--line-height-summary)`로 치환한다.
3. selector 구조, 순서, specificity와 computed 값을 유지한다.
4. 정적 검사와 Browser 검증을 별도 수행한다.

후속 구현에서 변경하지 않는 범위:

- `--line-height-compact`, `--line-height-body`, `--line-height-relaxed` 값
- 기존 Description selector 묶음
- Body, heading, helper, error, notice, metadata, Button, Badge line-height
- font-size, font-weight, spacing, control height
- mobile breakpoint와 layout
- React Component

## 23. Phase A3·Phase B 경계

```text
Line-height 계약 조사: 완료
Line-height CSS 구현: 미진행
Line-height Browser 검증: NOT_VERIFIED
Phase A3 전체: 미완료
Phase B: 미진행
```

Phase B의 Navigation·State Component 재설계, 공통 Typography Component와 전체 scale 정규화는 이 계약과 후속 최소 구현 범위에 포함하지 않는다.
