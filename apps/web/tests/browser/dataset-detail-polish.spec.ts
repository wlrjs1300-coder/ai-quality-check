import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const ids = { project: "11111111-1111-4111-8111-111111111111", dataset: "22222222-2222-4222-8222-222222222222", case: "33333333-3333-4333-8333-333333333333", version: "44444444-4444-4444-8444-444444444444" };
const now = "2026-08-01T09:00:00Z";
const meta = { request_id: "dataset-detail-polish" };
const longText = "긴 입력 내용 ".repeat(80);
const envelope = (data: unknown) => ({ data, meta });
const list = (data: unknown[], total = data.length, page = 1) => ({ data, meta: { ...meta, pagination: { total, page, size: 20 } } });
async function reply(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }

function dataset(active = true) { return { id: ids.dataset, project_id: ids.project, name: "한국어 정책 평가 Dataset", description: "배포 전 정책 응답을 검증합니다.", is_active: active }; }
function evaluationCase(overrides: Record<string, unknown> = {}) { return { id: ids.case, dataset_id: ids.dataset, case_key: "refund-period-001", question: longText, expected_summary: longText, evidence: [{ source_id: "policy", content: longText }], required_elements: [{ text: "7일 이내" }], forbidden_elements: [{ text: "무조건 환불" }], tags: [{ name: "refund" }], severity: "CRITICAL", required_for_release: true, status: "DRAFT", ...overrides }; }
function version(number = 3) { return { id: ids.version, dataset_id: ids.dataset, version: number, content_hash: "sha256-" + "a".repeat(96), case_count: 21, created_at: now }; }

type MockOptions = { active?: boolean; emptyCases?: boolean; emptyVersions?: boolean; datasetFailure?: boolean; caseFailureOnce?: boolean; versionFailureOnce?: boolean; versionCreateFailureOnce?: boolean };
async function mockDataset(page: Page, options: MockOptions = {}) {
  let item = evaluationCase();
  let caseFailed = false;
  let versionFailed = false;
  let createFailed = false;
  let versions = options.emptyVersions ? [] : [version()];
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith(`/datasets/${ids.dataset}`) && request.method() === "GET") {
      return options.datasetFailure ? reply(route, { error: { code: "DATASET_FAILED", message: "Dataset load failure" }, meta }, 500) : reply(route, envelope(dataset(options.active ?? true)));
    }
    if (path.endsWith(`/datasets/${ids.dataset}/evaluation-cases`) && request.method() === "GET") {
      if (options.caseFailureOnce && !caseFailed) { caseFailed = true; return reply(route, { error: { code: "CASE_FAILED", message: "Case load failure" }, meta }, 500); }
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const data = options.emptyCases ? [] : pageNumber === 2 ? [evaluationCase({ id: "55555555-5555-4555-8555-555555555555", case_key: "page-2" })] : [item];
      return reply(route, list(data, options.emptyCases ? 0 : 21, pageNumber));
    }
    if (path.endsWith(`/datasets/${ids.dataset}/evaluation-cases`) && request.method() === "POST") { item = evaluationCase({ case_key: "created-case", question: "생성된 질문" }); return reply(route, envelope(item), 201); }
    if (path.endsWith(`/evaluation-cases/${ids.case}`) && request.method() === "PATCH") { item = evaluationCase({ question: "수정된 질문" }); return reply(route, envelope(item)); }
    if (path.endsWith(`/evaluation-cases/${ids.case}/approve`)) { item = evaluationCase({ status: "APPROVED" }); return reply(route, envelope(item)); }
    if (path.endsWith(`/evaluation-cases/${ids.case}/deprecate`)) { item = evaluationCase({ status: "DEPRECATED" }); return reply(route, envelope(item)); }
    if (path.endsWith(`/datasets/${ids.dataset}/versions`) && request.method() === "GET") {
      if (options.versionFailureOnce && !versionFailed) { versionFailed = true; return reply(route, { error: { code: "VERSION_FAILED", message: "Version load failure" }, meta }, 500); }
      return reply(route, list(versions));
    }
    if (path.endsWith(`/datasets/${ids.dataset}/versions`) && request.method() === "POST") {
      if (options.versionCreateFailureOnce && !createFailed) { createFailed = true; return reply(route, { error: { code: "VERSION_NUMBER_CONFLICT", message: "conflict" }, meta }, 409); }
      versions = [version(4), ...versions]; return reply(route, envelope(versions[0]), 201);
    }
    return reply(route, { error: { code: "UNEXPECTED", message: `${request.method()} ${path}` }, meta }, 500);
  });
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) {
      expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      return;
    }
  }
  throw new Error("대상 Action에 Tab으로 접근하지 못했습니다.");
}

function observe(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedApiResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/backend/") && response.status() >= 400) failedApiResponses.push(`${response.status()} ${response.url()}`); });
  return { pageErrors, consoleErrors, failedApiResponses };
}

test("Dataset summary, hierarchy, long content, links, keyboard, and responsive layout", async ({ page }) => {
  const observation = observe(page);
  await mockDataset(page);
  await page.goto(`/projects/${ids.project}/datasets/${ids.dataset}`);
  await expect(page.getByRole("heading", { level: 1, name: "한국어 정책 평가 Dataset" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Dataset 요약" })).toBeVisible();
  await expect(page.locator(".status-badge").first()).toContainText("활성");
  await expect(page.getByText("Case").first()).toBeVisible();
  await expect(page.getByText("Version 3", { exact: true }).first()).toBeVisible();
  const headings = ["Dataset 요약", "Case 생성", "Case 목록", "Version 생성", "Version 목록"].map((name) => page.getByRole("heading", { level: 2, name }));
  for (let index = 0; index < headings.length - 1; index += 1) expect(await headings[index].evaluate((element, next) => Boolean(element.compareDocumentPosition(next!) & Node.DOCUMENT_POSITION_FOLLOWING), await headings[index + 1].elementHandle())).toBe(true);
  const card = page.locator(".case-card").first();
  await expect(card).toContainText("CRITICAL"); await expect(card).toContainText("Release 필수"); await expect(card).toContainText(longText.slice(0, 30));
  await card.getByText("기대 결과와 Metadata").click(); await expect(card.locator("pre")).toContainText("policy");
  await expect(page.getByRole("link", { name: "Version 상세" })).toHaveAttribute("href", `/projects/${ids.project}/datasets/${ids.dataset}/versions/3`);
  await tabTo(page, page.getByRole("link", { name: "Project Overview로 돌아가기" }));
  await tabTo(page, page.getByLabel("Case key"));
  await tabTo(page, card.getByRole("button", { name: "수정" }));
  await tabTo(page, card.getByRole("button", { name: "승인" }));
  await tabTo(page, card.getByRole("button", { name: "폐기" }));
  await tabTo(page, page.getByRole("button", { name: "Version 생성" }));
  await tabTo(page, page.getByRole("link", { name: "Version 상세" }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(observation.pageErrors).toEqual([]); expect(observation.consoleErrors).toEqual([]); expect(observation.failedApiResponses).toEqual([]);
});

test("Case validation, creation, editing, approval, deprecation, pagination, and Version creation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "변경 계약은 대표 viewport에서 검증합니다.");
  await mockDataset(page, { versionCreateFailureOnce: true });
  await page.goto(`/projects/${ids.project}/datasets/${ids.dataset}`);
  await page.getByRole("button", { name: "Case 생성", exact: true }).click();
  expect(await page.getByLabel("Case key").evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await page.getByLabel("Case key").fill("created-case"); await page.getByLabel("질문").fill("생성된 질문"); await page.getByRole("button", { name: "Case 생성", exact: true }).click(); await expect(page.locator(".case-card").first()).toContainText("created-case");
  await page.reload(); const card = page.locator(".case-card").first(); await card.getByRole("button", { name: "수정" }).click(); await page.getByLabel("질문").fill("수정된 질문"); await page.getByRole("button", { name: "수정 저장" }).click(); await expect(card).toContainText("수정된 질문");
  await card.getByRole("button", { name: "승인" }).click(); await expect(card).toContainText("APPROVED");
  page.once("dialog", (dialog) => dialog.accept()); await card.getByRole("button", { name: "폐기" }).click(); await expect(card).toContainText("DEPRECATED");
  await page.getByRole("navigation", { name: "Evaluation cases pagination" }).getByRole("button", { name: "다음" }).click(); await expect(page.getByText("page-2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Version 생성" }).click(); await expect(page.getByText("Version 번호 충돌이 발생했습니다. 목록을 갱신한 뒤 다시 시도해 주세요.")).toBeVisible();
  await page.getByRole("button", { name: "Version 생성" }).click(); await expect(page.getByRole("heading", { level: 3, name: "Version 4" })).toBeVisible();
});

test("Inactive and empty Dataset states remain clear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "상태 조합은 대표 viewport에서 검증합니다.");
  await mockDataset(page, { active: false, emptyCases: true, emptyVersions: true }); await page.goto(`/projects/${ids.project}/datasets/${ids.dataset}`);
  await expect(page.locator(".status-badge").first()).toContainText("비활성"); await expect(page.getByText("등록된 Case가 없습니다.")).toBeVisible(); await expect(page.getByText("생성된 Version이 없습니다.")).toBeVisible(); await expect(page.getByRole("button", { name: "Case 생성", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Version 생성" })).toBeDisabled();
});

test("Dataset and partial list errors preserve recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "오류 계약은 대표 viewport에서 검증합니다.");
  await mockDataset(page, { datasetFailure: true }); await page.goto(`/projects/${ids.project}/datasets/${ids.dataset}`); await expect(page.getByText("Dataset load failure")).toBeVisible();
  await page.unrouteAll({ behavior: "wait" }); await mockDataset(page, { caseFailureOnce: true, versionFailureOnce: true }); await page.reload();
  await expect(page.getByText("Case load failure")).toBeVisible(); await expect(page.getByText("Version load failure")).toBeVisible();
  const retryButtons = page.getByRole("button", { name: "다시 시도" }); await retryButtons.first().click(); await expect(page.locator(".case-card")).toHaveCount(1); await retryButtons.first().click(); await expect(page.getByRole("heading", { level: 3, name: "Version 3" })).toBeVisible();
});
