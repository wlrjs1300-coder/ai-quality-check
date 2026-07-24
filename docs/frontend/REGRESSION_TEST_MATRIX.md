# Frontend Regression Test Matrix

??臾몄꽌???꾩옱 App Router??議댁옱?섎뒗 13媛?Route???뚭? 湲곗?怨?寃利?利앷굅瑜?湲곕줉?⑸땲?? ?곹깭??湲곕뒫 援ы쁽 ?щ?媛 ?꾨땲???대떦 ?쒕굹由ъ삤??**?꾩옱 寃利??섏?**???삵빀?덈떎.

## 湲곕줉 洹쒖튃

?꾩옱 ?곹깭???ㅼ쓬 媛믩쭔 ?ъ슜?⑸땲??

- `VERIFIED_MANUAL`: Browser?먯꽌 吏곸젒 ?뺤씤?덉쑝????μ냼??吏??媛?ν븳 ?먮룞 利앷굅???놁쓬
- `STATIC_ONLY`: Typecheck, lint, production build濡쒕쭔 ?뺤씤
- `NOT_VERIFIED_DATA_LIMIT`: ?꾩슂??Demo ?곗씠?곌? ?놁뼱 誘명솗??- `REGRESSION_REQUIRED`: 援ы쁽? ?뺤씤?섏?留??대쾲 湲곗????댄썑 Browser ?ш?利??꾩슂
- `NOT_IMPLEMENTED`: UI ?먮뒗 ?먮룞 寃利?寃쎈줈媛 援ы쁽?섏? ?딆쓬
- `BLOCKED_BY_BACKEND`: ?꾩슂??Backend 怨꾩빟???놁뼱 寃利?遺덇?

寃利??좏삎? `Browser Manual`, `Typecheck`, `Lint`, `Production Build`, `Backend Test`, `API Smoke`, `Not Tested` 以??섎굹 ?댁긽???ъ슜?⑸땲?? 利앷굅 ?섏?? `Repository Evidence`, `Session Manual Evidence`, `No Durable Evidence` 以??섎굹?낅땲??

`Session Manual Evidence`???뱀떆 ?뺤씤 ?ъ떎??蹂댁〈?섏?留?Screenshot?대굹 ?먮룞??Report媛 ??μ냼???⑥븘 ?덈떎???살? ?꾨떃?덈떎. ?좎쭨媛 ?녿뒗 ??ぉ? 寃利??꾨즺濡?媛꾩＜?섏? ?딆뒿?덈떎.

## Route Inventory

| ID | ?곸뿭 | Route | ?쒕굹由ъ삤 | ?ъ쟾 議곌굔 | ?꾩슂??Demo ?곗씠??| ?덉긽 寃곌낵 | ?꾩옱 ?곹깭 | 寃利??좏삎 | 留덉?留?寃利앹씪 | 利앷굅 ?섏? | ?먮룞???꾨낫 | 鍮꾧퀬 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | Entry | `/` | 珥덇린 吏꾩엯 | Web ?ㅽ뻾 | ?놁쓬 | `/projects`濡??대룞 | STATIC_ONLY | Production Build | - | Repository Evidence | Route smoke | Redirect 肄붾뱶留??뺤씤 |
| R02 | Projects | `/projects` | 紐⑸줉쨌?앹꽦쨌?ㅻ쪟쨌?ъ떆??| Backend 諛?Project API | Project 1嫄??댁긽 | 紐⑸줉怨??앹꽦 Form, ?깃났 ??理쒖떊 紐⑸줉 ?쒖떆 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | ?꾩옱 泥?20嫄대쭔 ?묎렐 媛??|
| R03 | Project | `/projects/{projectId}` | Dashboard쨌Summary쨌Registry 吏꾩엯 | ?좏슚 Project | Demo Seed Project | Release ?곹깭, KPI, 理쒓렐 ?ㅽ뻾怨?Registry ?쒖떆 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | ?섏쐞 Panel? ?낅┰ ?ㅻ쪟 泥섎━ |
| R04 | History | `/projects/{projectId}/history` | 紐⑸줉쨌?꾪꽣쨌CSV쨌?곸꽭 ?대룞 | ?좏슚 Project | ??Demo Experiment | ?꾪꽣??History, CSV, Experiment쨌Comparison 留곹겕 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | ?붾㈃? Trend API瑜?吏곸젒 ?몄텧?섏? ?딆쓬 |
| R05 | Dataset | `/projects/{projectId}/datasets/{datasetId}` | Case? Version 愿由?| ?좏슚 Project쨌Dataset | DRAFT쨌APPROVED Case | Case ?곹깭 ?꾩씠? Version 紐⑸줉쨌?앹꽦 ?쒖떆 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | 404 蹂듦?? URL Project scope 蹂닿컯 ?꾩슂 |
| R06 | Dataset Version | `/projects/{projectId}/datasets/{datasetId}/versions/{version}` | 遺덈? Snapshot 議고쉶 | Dataset Version 議댁옱 | Snapshot Case | Hash? Case Snapshot ?쒖떆 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | 404 蹂듦?? scope 蹂닿컯 ?꾩슂 |
| R07 | Target | `/projects/{projectId}/targets/{targetId}` | MOCK ?ㅼ젙쨌FIXED Version | ?좏슚 Target | Version 1쨌2 | ?ㅼ젙 ??? 鍮꾪솢?깊솕, 遺덈? Version ?쒖떆 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | URL Project scope ?議?蹂닿컯 ?꾩슂 |
| R08 | Target Version | `/projects/{projectId}/targets/{targetId}/versions/{version}` | FIXED Snapshot 議고쉶쨌404 蹂듦뎄 | Target Version 議댁옱 ?먮뒗 404 | Version 1쨌2 | Snapshot ?쒖떆 ?먮뒗 Target ?곸꽭 蹂듦? | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | ?붿껌 AbortSignal 蹂닿컯 ?꾩슂 |
| R09 | Evaluator | `/projects/{projectId}/evaluators/{evaluatorId}` | ?ㅼ젙쨌Version 愿由?| ?좏슚 Evaluator | 3媛?Evaluator Type | ?ㅼ젙怨?遺덈? Version ?쒖떆 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | URL Project scope ?議?蹂닿컯 ?꾩슂 |
| R10 | Evaluator Version | `/projects/{projectId}/evaluators/{evaluatorId}/versions/{version}` | Evaluator Snapshot 議고쉶쨌404 蹂듦뎄 | Evaluator Version 議댁옱 ?먮뒗 404 | Version 1쨌2, REGEX | Snapshot ?쒖떆 ?먮뒗 Evaluator ?곸꽭 蹂듦? | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | ?붿껌 AbortSignal 蹂닿컯 ?꾩슂 |
| R11 | Experiment | `/projects/{projectId}/experiments/new` | Version ?좏깮怨??앹꽦 | 媛?Version 1媛??댁긽 | Dataset쨌Target쨌Evaluator Version | ?꾩닔 ?좏깮 寃利???Experiment ?앹꽦 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | ?대쫫怨?Version 踰덊샇瑜??④퍡 ?쒖떆 |
| R12 | Experiment | `/projects/{projectId}/experiments/{experimentId}` | Inline ?ㅽ뻾쨌Result쨌Gate쨌Comparison | ?좏슚 Experiment | PASS Result? Gate/Comparison ?곗씠??| ?곹깭쨌Result쨌?먯젙 ?쒖떆, ?덈줈怨좎묠 蹂듭썝 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | 湲??붾㈃怨?湲곗닠 ?뺣낫 怨쇰떎 ?몄텧 媛쒖꽑 ?꾩슂 |
| R13 | Comparison | `/projects/{projectId}/comparisons/{comparisonId}` | Summary쨌Case Diff쨌scope쨌404 | ?좏슚 Comparison | REGRESSED 諛?Case Diff 5嫄?| ?꾩껜 ?먯젙怨?Case 蹂???쒖떆 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | Summary? Case ?ㅻ쪟???낅┰ 泥섎━ |

## ?섎룞 寃利?利앷굅

?ㅼ쓬 ??ぉ? 2026-07-23 ?몄뀡?먯꽌 ?ㅼ젣 Browser濡??뺤씤?덉뒿?덈떎. 紐⑤몢 `VERIFIED_MANUAL`, `Browser Manual`, `Session Manual Evidence`?대ŉ ??μ냼??Screenshot ?먮뒗 ?먮룞??Report??蹂닿??섏? ?딆뒿?덈떎.

| ID | ?곸뿭 | ?뺤씤???쒕굹由ъ삤 |
|---|---|---|
| M01 | Experiment | ?앹꽦 ?붾㈃, ??Version ?좏깮, ?앹꽦, Inline ?ㅽ뻾, `COMPLETED`, PASS Result |
| M02 | Experiment | ?덈줈怨좎묠 蹂듭썝, Backend 以묐떒 Network Error? Retry, ?ъ떎??李⑤떒 |
| M03 | History / Dashboard | 紐⑸줉, ?꾪꽣 UI, CSV ?ㅼ슫濡쒕뱶, Experiment ?곸꽭 留곹겕 |
| M04 | History / Dashboard | Comparison ?곸꽭 留곹겕, Dashboard 理쒖떊 Comparison 留곹겕 |
| M05 | History / Dashboard | Project 404, ?섎せ??Project scope 李⑤떒, Network Error? Retry |
| M06 | History / Dashboard | Tab focus? Enter ???대룞 |
| M07 | Quality Gate | `COMPLETED` Form, 湲곕낯媛? 0% ?덉슜, 101% 李⑤떒, Policy ?앹꽦, PASS |
| M08 | Quality Gate | ?쎄린 ?꾩슜 Result, ?덈줈怨좎묠 蹂듭썝, 湲곗〈 BLOCK Result ?쒖떆 |
| M09 | Quality Gate | Network 蹂듦뎄 ??Result 蹂듭썝 |
| M10 | Baseline Comparison | Empty ?꾨낫, ?꾨낫 scope, 媛숈? Dataset Version ?꾪꽣, Current ?먯떊 ?쒖쇅 |
| M11 | Baseline Comparison | Radio ?좏깮, REGRESSED ?앹꽦, `-20.00%p`, Summary, Case Diff 5嫄?|
| M12 | Baseline Comparison | ?덈줈怨좎묠 蹂듭썝, History쨌Dashboard 留곹겕, ?ㅻⅨ Project scope 李⑤떒 |
| M13 | Baseline Comparison | Network Error? Retry |

## ?꾩쭅 寃利앺븯吏 ?딆? ?듭떖 ?쒕굹由ъ삤

| ID | ?쒕굹由ъ삤 | ?꾩옱 ?곹깭 | 寃利??좏삎 | 利앷굅 ?섏? | ?꾩슂??議곌굔 |
|---|---|---|---|---|---|
| U01 | ??`IMPROVED` Comparison ?앹꽦 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 媛쒖꽑 Result ??|
| U02 | ??`UNCHANGED` Comparison ?앹꽦 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | ?숈씪 ?깅뒫 Result ??|
| U03 | ??Gate `BLOCK` ?앹꽦 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | ?꾩닔 Case ?ㅽ뙣 Experiment |
| U04 | 以묐났 Gate 蹂듦뎄 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 湲곗〈 Gate? ?숈씪 ?ъ슂泥?|
| U05 | 以묐났 Comparison 蹂듦뎄 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 湲곗〈 鍮꾧탳 ???ъ슂泥?|
| U06 | `FAILED` Experiment ?곸꽭 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | ?ㅽ뻾 ?ㅽ뙣 Experiment |
| U07 | 20嫄?珥덇낵 紐⑸줉 ?섏씠吏?ㅼ씠??| NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 21嫄??댁긽 Project쨌Dataset |
| U08 | Dashboard ?섏쐞 API ?⑤룆 ?μ븷 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | ?좏깮???ㅽ뙣 二쇱엯 |

## ?먮룞???꾪솴

?꾩옱 ??μ냼?먯꽌 利앸챸 媛?ν븳 Frontend ?먮룞 寃利앹? TypeScript typecheck, ESLint, Next.js production build?낅땲?? Playwright, Cypress, Vitest, Jest 湲곕컲 Browser쨌Component쨌Unit Test??議댁옱?섏? ?딆뒿?덈떎. ?곕씪??Browser ?숈옉???먮룞 寃利앺뻽?ㅺ퀬 ?쒗쁽?섏? ?딆쑝硫? ???섎룞 利앷굅瑜?吏??媛?ν븳 利앷굅濡?諛붽씀???묒뾽? 蹂꾨룄 援ы쁽 PR濡?吏꾪뻾?⑸땲??
