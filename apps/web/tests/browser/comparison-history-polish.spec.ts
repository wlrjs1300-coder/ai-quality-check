import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const ids = { project: "11111111-1111-4111-8111-111111111111", comparison: "22222222-2222-4222-8222-222222222222", baseline: "33333333-3333-4333-8333-333333333333", current: "44444444-4444-4444-8444-444444444444", dataset: "55555555-5555-4555-8555-555555555555", target: "66666666-6666-4666-8666-666666666666", evaluator: "77777777-7777-4777-8777-777777777777" };
const now = "2026-08-01T09:00:00Z";
const meta = { request_id: "comparison-history-test" };
const envelope = (data: unknown) => ({ data, meta });
const list = (data: unknown[], total = data.length, page = 1) => ({ data, meta: { ...meta, pagination: { total, page, size: 20 } } });
async function reply(route: Route, body: unknown, status = 200, contentType = "application/json") { await route.fulfill({ status, contentType, body: typeof body === "string" ? body : JSON.stringify(body) }); }

function comparison(status: "IMPROVED" | "UNCHANGED" | "REGRESSED" = "REGRESSED", reasons = true) { return { id: ids.comparison, project_id: ids.project, baseline_experiment_id: ids.baseline, current_experiment_id: ids.current, status, total_case_count: 30, improved_case_count: 2, unchanged_case_count: 26, regressed_case_count: 2, baseline_passed_case_count: 27, current_passed_case_count: 25, pass_rate_delta: status === "IMPROVED" ? "0.1" : status === "UNCHANGED" ? "0" : "-0.0667", reason_codes: reasons ? ["PASS_RATE_REGRESSION", "CRITICAL_CASE_REGRESSED"] : [], reason_summary: reasons ? "중요 Case가 회귀했습니다." : null, created_at: now }; }
function experiment(id: string, pass: number) { return { id, dataset_version_id: ids.dataset, target_version_id: ids.target, evaluator_version_id: ids.evaluator, status: "COMPLETED", total_cases: 30, pass_count: pass, fail_count: 30 - pass, error_count: 0, completed_at: now, error_code: null, error_message: null }; }
function historyItem(id: string, gate: "PASS" | "BLOCK" | null, comparisonStatus: "IMPROVED" | "UNCHANGED" | "REGRESSED" | null) { return { experiment_id: id, dataset_version_id: ids.dataset, target_version_id: ids.target, evaluator_version_id: ids.evaluator, experiment_status: "COMPLETED", total_case_count: 30, passed_case_count: 27, failed_case_count: 2, error_case_count: 1, pass_rate: "0.9", created_at: now, started_at: now, completed_at: now, quality_gate_result: gate ? { result_id: `gate-${id}`, policy_id: "policy", status: gate, pass_rate: "0.9", reason_codes: [], created_at: now } : null, baseline_comparison: comparisonStatus ? { comparison_id: ids.comparison, baseline_experiment_id: ids.baseline, current_experiment_id: id, status: comparisonStatus, pass_rate_delta: "-0.1", reason_codes: [], created_at: now } : null }; }

async function tabTo(page: Page, target: Locator, name: string) { for (let index = 0; index < 16; index += 1) { await page.keyboard.press("Tab"); if (await target.evaluate((element) => document.activeElement === element)) { expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none"); return; } } throw new Error(`${name}에 Tab으로 도달하지 못했습니다.`); }

async function mockComparison(page: Page, status: "IMPROVED" | "UNCHANGED" | "REGRESSED" = "REGRESSED", reasons = true) {
  await page.route("**/api/backend/**", async (route) => { const url = new URL(route.request().url()); const path = url.pathname;
    if (path.endsWith(`/baseline-comparisons/${ids.comparison}`)) await reply(route, envelope(comparison(status, reasons)));
    else if (path.endsWith(`/baseline-comparisons/${ids.comparison}/cases`)) await reply(route, list([{ id: "case-1", comparison_id: ids.comparison, dataset_version_case_id: "case-version-1", case_key: "refund-001", baseline_status: "PASS", current_status: "FAIL", change_status: "REGRESSED", reason_code: "CASE_REGRESSED", created_at: now }]));
    else if (path.endsWith(`/experiments/${ids.baseline}`)) await reply(route, envelope(experiment(ids.baseline, 27)));
    else if (path.endsWith(`/experiments/${ids.current}`)) await reply(route, envelope(experiment(ids.current, 25)));
    else await reply(route, { error: { code: "UNEXPECTED", message: path }, meta }, 500);
  });
}

async function mockHistory(page: Page, options: { empty?: boolean; failOnce?: boolean; csvFailure?: boolean } = {}) {
  let failed = false;
  await page.route("**/api/backend/**", async (route) => { const url = new URL(route.request().url()); const path = url.pathname;
    if (path.endsWith("experiment-history.csv")) { if (options.csvFailure) await reply(route, { error: { code: "CSV_FAILED", message: "CSV download failure" }, meta }, 500); else await reply(route, "experiment_id,status\nitem-1,COMPLETED", 200, "text/csv"); }
    else if (path.includes("experiment-history")) { if (options.failOnce && !failed) { failed = true; await reply(route, { error: { code: "HISTORY_FAILED", message: "History test failure" }, meta }, 500); } else { const requestedPage = Number(url.searchParams.get("page") ?? "1"); const items = options.empty ? [] : requestedPage === 2 ? [historyItem("item-21", "PASS", "IMPROVED")] : [historyItem("item-1", "BLOCK", "REGRESSED"), historyItem("item-2", null, null)]; await reply(route, list(items, options.empty ? 0 : 21, requestedPage)); } }
    else await reply(route, { error: { code: "UNEXPECTED", message: path }, meta }, 500);
  });
}

test("Comparison decision hierarchy, states, cards, actions, and responsive layout", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedApiResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/backend/") && response.status() >= 400) failedApiResponses.push(`${response.status()} ${response.url()}`); });
  await mockComparison(page); await page.goto(`/projects/${ids.project}/comparisons/${ids.comparison}`); await expect(page.getByRole("heading", { level: 1, name: "Comparison 상세" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1); const decision = page.getByRole("heading", { level: 2, name: "Comparison 결과" }); const experiments = page.getByRole("heading", { level: 2, name: "비교 Experiment" }); const cases = page.getByRole("heading", { level: 2, name: "Case별 변화" });
  expect(await decision.evaluate((element) => document.querySelector("main h2") === element)).toBe(true); expect(await decision.evaluate((element, following) => Boolean(element.compareDocumentPosition(following!) & Node.DOCUMENT_POSITION_FOLLOWING), await experiments.elementHandle())).toBe(true); expect(await experiments.evaluate((element, following) => Boolean(element.compareDocumentPosition(following!) & Node.DOCUMENT_POSITION_FOLLOWING), await cases.elementHandle())).toBe(true);
  await expect(page.getByText("-6.67%p", { exact: true })).toBeVisible(); await expect(page.getByText("PASS_RATE_REGRESSION", { exact: true })).toBeVisible(); await expect(page.locator(".comparison-experiment-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Baseline Experiment 상세/ })).toHaveAttribute("href", `/projects/${ids.project}/experiments/${ids.baseline}`); await expect(page.getByRole("link", { name: /Current Experiment 상세/ })).toHaveAttribute("href", `/projects/${ids.project}/experiments/${ids.current}`);
  await tabTo(page, page.getByRole("link", { name: "History로 돌아가기" }), "History 복귀"); await tabTo(page, page.getByRole("link", { name: "Project Overview로 돌아가기" }), "Project Overview 복귀");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedApiResponses).toEqual([]);
});

for (const [status, reasons] of [["IMPROVED", false], ["UNCHANGED", false], ["REGRESSED", true]] as const) { test(`Comparison ${status} with ${reasons ? "reasons" : "no reasons"}`, async ({ page }, testInfo) => { test.skip(testInfo.project.name !== "desktop-1440", "상태 조합은 대표 viewport에서 검증합니다."); await mockComparison(page, status, reasons); await page.goto(`/projects/${ids.project}/comparisons/${ids.comparison}`); await expect(page.getByText(status, { exact: true }).first()).toBeVisible(); await expect(page.getByText(reasons ? "PASS_RATE_REGRESSION" : "Reason Code가 없습니다.", { exact: true })).toBeVisible(); }); }

test("History filters, cards, pagination, CSV, keyboard, and responsive layout", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedApiResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/backend/") && response.status() >= 400) failedApiResponses.push(`${response.status()} ${response.url()}`); });
  await mockHistory(page); await page.goto(`/projects/${ids.project}/history`); await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible(); await expect(page.locator("h1")).toHaveCount(1); await expect(page.locator(".history-result-card")).toHaveCount(2); await expect(page.locator(".history-result-card").nth(1)).toContainText("Quality Gate 없음"); await expect(page.locator(".history-result-card").nth(1)).toContainText("Comparison 없음"); await expect(page.locator(".history-result-card").nth(1).getByRole("link", { name: /Comparison 상세/ })).toHaveCount(0);
  await page.getByLabel("시작일").fill("2026-07-01"); await page.getByLabel("종료일").fill("2026-07-31"); await page.getByLabel("Experiment 상태").selectOption("COMPLETED"); await page.getByLabel("Gate 상태").selectOption("BLOCK"); await page.getByLabel("Comparison 상태").selectOption("REGRESSED"); await page.getByLabel("정렬").selectOption("created_at_asc"); await page.getByRole("button", { name: "적용" }).click(); await expect(page).toHaveURL(/from=2026-07-01.*to=2026-07-31.*experiment_status=COMPLETED.*gate_status=BLOCK.*comparison_status=REGRESSED.*sort=created_at_asc/);
  await page.getByRole("button", { name: "다음" }).click(); await expect(page).toHaveURL(/page=2/); const download = page.waitForEvent("download"); await page.getByRole("button", { name: "CSV 다운로드" }).click(); expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("button", { name: "초기화" }).click(); await expect(page).toHaveURL(`/projects/${ids.project}/history`); await tabTo(page, page.getByRole("button", { name: "CSV 다운로드" }), "CSV 다운로드"); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedApiResponses).toEqual([]);
});

test("History Empty, API retry, and CSV failure remain recoverable", async ({ page }, testInfo) => { test.skip(testInfo.project.name !== "desktop-1440", "오류 계약은 대표 viewport에서 검증합니다."); await mockHistory(page, { failOnce: true, csvFailure: true }); await page.goto(`/projects/${ids.project}/history`); await expect(page.getByText("History test failure")).toBeVisible(); await page.getByRole("button", { name: "다시 시도" }).click(); await expect(page.locator(".history-result-card")).toHaveCount(2); await page.getByRole("button", { name: "CSV 다운로드" }).click(); await expect(page.getByText("CSV download failure")).toBeVisible(); await page.unrouteAll({ behavior: "wait" }); await mockHistory(page, { empty: true }); await page.reload(); await expect(page.getByRole("heading", { name: "조건에 맞는 History가 없습니다" })).toBeVisible(); });
