import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const ids = { project: "11111111-1111-4111-8111-111111111111", experiment: "22222222-2222-4222-8222-222222222222", dataset: "33333333-3333-4333-8333-333333333333", datasetVersion: "44444444-4444-4444-8444-444444444444", target: "55555555-5555-4555-8555-555555555555", targetVersion: "66666666-6666-4666-8666-666666666666", evaluator: "77777777-7777-4777-8777-777777777777", evaluatorVersion: "88888888-8888-4888-8888-888888888888" };
const now = "2026-08-01T09:00:00Z";
type Status = "CREATED" | "RUNNING" | "COMPLETED" | "FAILED";
type Options = { status?: Status; gateStatus?: "PASS" | "BLOCK"; targetFailure?: boolean; evaluatorFailure?: boolean; resultFailureOnce?: boolean; experimentFailure?: boolean };

const meta = { request_id: "experiment-detail-test" };
const envelope = (data: unknown) => ({ data, meta });
const paginated = (data: unknown[], total = data.length, page = 1) => ({ data, meta: { ...meta, pagination: { total, page, size: 20 } } });
async function reply(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }

function experiment(status: Status) {
  return { id: ids.experiment, dataset_version_id: ids.datasetVersion, target_version_id: ids.targetVersion, evaluator_version_id: ids.evaluatorVersion, status, total_cases: status === "CREATED" || status === "RUNNING" ? 0 : 21, pass_count: status === "COMPLETED" ? 18 : 0, fail_count: status === "COMPLETED" ? 2 : 0, error_count: status === "COMPLETED" ? 1 : 0, completed_at: status === "COMPLETED" || status === "FAILED" ? now : null, error_code: status === "FAILED" ? "TARGET_EXECUTION_FAILED" : null, error_message: status === "FAILED" ? "Target 실행을 완료하지 못했습니다." : null };
}

function historyItem(id: string, comparisonStatus: "IMPROVED" | "UNCHANGED" | "REGRESSED" | null = null, gate = false) {
  return { experiment_id: id, dataset_version_id: ids.datasetVersion, target_version_id: ids.targetVersion, evaluator_version_id: ids.evaluatorVersion, experiment_status: "COMPLETED", total_case_count: 21, passed_case_count: 18, failed_case_count: 2, error_case_count: 1, pass_rate: "0.8571", created_at: now, started_at: now, completed_at: now,
    quality_gate_result: gate ? { result_id: "gate-result", policy_id: "gate-policy", status: "BLOCK", pass_rate: "0.8571", reason_codes: ["ERROR_PRESENT"], created_at: now } : null,
    baseline_comparison: comparisonStatus ? { comparison_id: `comparison-${comparisonStatus}`, baseline_experiment_id: "baseline", current_experiment_id: id, status: comparisonStatus, pass_rate_delta: comparisonStatus === "REGRESSED" ? "-0.1" : "0.1", reason_codes: [], created_at: now } : null };
}

function result(index: number, status: "PASS" | "FAIL" | "ERROR") {
  return { id: `result-${index}`, experiment_id: ids.experiment, dataset_version_case_id: `case-${index}-${"x".repeat(60)}`, input_snapshot: { question: `input ${index}`, long: "x".repeat(300) }, output_snapshot: { answer: `output ${index}` }, status, reason_code: status === "PASS" ? null : status === "FAIL" ? "MISSING_CONDITION" : "TARGET_ERROR", reason: status === "PASS" ? null : status === "FAIL" ? "필수 조건이 누락되었습니다." : "Target 응답 오류입니다.", created_at: now };
}

async function mockDetail(page: Page, options: Options = {}) {
  let resultFailed = false;
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const status = options.status ?? "COMPLETED";
    if (path.endsWith(`/experiments/${ids.experiment}`)) {
      await reply(route, options.experimentFailure ? { error: { code: "TEST_FAILURE", message: "Experiment test failure" }, meta } : envelope(experiment(status)), options.experimentFailure ? 500 : 200);
    } else if (path.endsWith(`/experiments/${ids.experiment}/run`)) {
      await reply(route, envelope(experiment("COMPLETED")));
    } else if (path.endsWith(`/experiments/${ids.experiment}/results`)) {
      if (options.resultFailureOnce && !resultFailed) { resultFailed = true; await reply(route, { error: { code: "TEST_FAILURE", message: "Result test failure" }, meta }, 500); return; }
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      await reply(route, paginated(pageNumber === 1 ? [result(1, "PASS"), result(2, "FAIL"), result(3, "ERROR")] : [result(21, "PASS")], 21, pageNumber));
    } else if (path.endsWith(`/projects/${ids.project}/datasets`)) {
      await reply(route, paginated([{ id: ids.dataset, project_id: ids.project, name: "Release Dataset", description: null, is_active: true }]));
    } else if (path.endsWith(`/datasets/${ids.dataset}/versions`)) {
      await reply(route, paginated([{ id: ids.datasetVersion, dataset_id: ids.dataset, version: 3, content_hash: "dataset-hash", case_count: 21, created_at: now }]));
    } else if (path.endsWith(`/target-versions/${ids.targetVersion}`)) {
      await reply(route, options.targetFailure ? { error: { code: "TARGET_METADATA_FAILED", message: "Target metadata failure" }, meta } : envelope({ id: ids.targetVersion, target_id: ids.target, version: 2, content_hash: "target-hash", config_snapshot: {}, response_strategy: "FIXED", latency_ms: 0, failure_rate: 0, created_at: now }), options.targetFailure ? 500 : 200);
    } else if (path.endsWith(`/targets/${ids.target}`)) {
      await reply(route, envelope({ id: ids.target, project_id: ids.project, name: "Mock Target", target_type: "MOCK", config: {}, is_active: true }));
    } else if (path.endsWith(`/evaluator-versions/${ids.evaluatorVersion}`)) {
      await reply(route, options.evaluatorFailure ? { error: { code: "EVALUATOR_METADATA_FAILED", message: "Evaluator metadata failure" }, meta } : envelope({ id: ids.evaluatorVersion, evaluator_id: ids.evaluator, version: 4, content_hash: "evaluator-hash", evaluator_type_snapshot: "CONTAINS", config_snapshot: {}, created_at: now }), options.evaluatorFailure ? 500 : 200);
    } else if (path.endsWith(`/evaluators/${ids.evaluator}`)) {
      await reply(route, envelope({ id: ids.evaluator, project_id: ids.project, name: "Contains Evaluator", evaluator_type: "CONTAINS", config: {}, is_active: true, created_at: now, updated_at: now }));
    } else if (path.includes("experiment-history")) {
      await reply(route, paginated([historyItem(ids.experiment, null, true), historyItem("baseline-improved", "IMPROVED"), historyItem("baseline-unchanged", "UNCHANGED"), historyItem("baseline-regressed", "REGRESSED")], 4));
    } else if (path.endsWith("/quality-gate-results/gate-result")) {
      const gateStatus = options.gateStatus ?? "BLOCK";
      await reply(route, envelope({ id: "gate-result", policy_id: "gate-policy", experiment_id: ids.experiment, status: gateStatus, pass_rate: "0.8571", total_case_count: 21, passed_case_count: 18, failed_case_count: 2, error_case_count: 1, required_case_failure_count: gateStatus === "BLOCK" ? 1 : 0, reason_codes: gateStatus === "BLOCK" ? ["ERROR_PRESENT"] : [], reason_summary: gateStatus === "BLOCK" ? "오류 결과로 배포를 차단합니다." : "배포 기준을 충족했습니다.", created_at: now }));
    } else if (path.endsWith("/quality-gate-policies/gate-policy")) {
      await reply(route, envelope({ id: "gate-policy", project_id: ids.project, name: "Release Gate", minimum_pass_rate: "0.95", block_on_error: true, block_on_required_case_failure: true, is_active: true, created_at: now, updated_at: now }));
    } else { await reply(route, { error: { code: "UNEXPECTED_TEST_REQUEST", message: path }, meta }, 500); }
  });
}

async function open(page: Page) { await page.goto(`/projects/${ids.project}/experiments/${ids.experiment}`); await expect(page.getByRole("heading", { level: 1, name: "Experiment 상세" })).toBeVisible(); }

async function expectTabFocus(page: Page, target: Locator, targetName: string) {
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) {
      expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      return;
    }
  }
  throw new Error(`${targetName}에 실제 Tab 이동으로 도달하지 못했습니다.`);
}

async function expectHeadingBefore(first: Locator, second: Locator) {
  const secondElement = await second.elementHandle();
  expect(secondElement).not.toBeNull();
  const precedes = await first.evaluate((firstElement, followingElement) => (
    followingElement !== null
    && Boolean(firstElement.compareDocumentPosition(followingElement) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), secondElement);
  await secondElement?.dispose();
  expect(precedes).toBe(true);
}

test("completed result hierarchy, decisions, results, pagination, snapshots, and layout", async ({ page }) => {
  const errors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/backend/") && response.status() >= 400) failedResponses.push(response.url()); });
  await mockDetail(page);
  await open(page);
  await expectTabFocus(page, page.getByRole("link", { name: "History로 돌아가기" }), "History로 돌아가기");
  await expectTabFocus(page, page.getByRole("button", { name: "후보 다시 확인" }), "후보 다시 확인");
  await expect(page.locator("h1")).toHaveCount(1);
  const executionHeading = page.getByRole("heading", { level: 2, name: "실행 결과" });
  const gateHeading = page.getByRole("heading", { level: 2, name: "Basic Quality Gate" });
  const comparisonHeading = page.getByRole("heading", { level: 2, name: "Baseline Comparison" });
  const resultsHeading = page.getByRole("heading", { level: 2, name: "Evaluation Results" });
  const configurationHeading = page.getByRole("heading", { level: 2, name: "실행 구성" });
  await expect(executionHeading).toBeVisible();
  expect(await executionHeading.evaluate((element) => document.querySelector("main h2") === element)).toBe(true);
  await expectHeadingBefore(gateHeading, comparisonHeading);
  await expectHeadingBefore(comparisonHeading, resultsHeading);
  await expectHeadingBefore(resultsHeading, configurationHeading);
  await expect(page.locator(".experiment-summary-grid")).toContainText("Experiment 상태COMPLETED전체 Case21PASS18FAIL2ERROR1완료 시각");
  await expect(page.getByText("실패 또는 실행 오류가 포함된 결과입니다.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic Quality Gate" })).toBeVisible();
  await expect(page.getByText("BLOCK", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("IMPROVED", { exact: true })).toBeVisible();
  await expect(page.getByText("UNCHANGED", { exact: true })).toBeVisible();
  await expect(page.getByText("REGRESSED", { exact: true })).toBeVisible();
  await expect(page.locator(".result-card-pass")).toHaveCount(1);
  await expect(page.locator(".result-card-fail")).toContainText("MISSING_CONDITION");
  await expect(page.locator(".result-card-error")).toContainText("TARGET_ERROR");
  const inputDetails = page.getByText("Input Snapshot", { exact: true }).first();
  await inputDetails.click();
  await expect(inputDetails.locator("..").locator("pre")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("2 / 2 페이지")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

for (const status of ["CREATED", "RUNNING", "FAILED"] as const) {
  test(`${status} state exposes the correct action or failure`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "상태 계약은 대표 viewport에서 검증합니다.");
    await mockDetail(page, { status });
    await open(page);
    if (status === "CREATED") {
      await expect(page.getByRole("button", { name: "Inline 실행" })).toBeEnabled();
      await expectTabFocus(page, page.getByRole("button", { name: "Inline 실행" }), "Inline 실행");
    }
    if (status === "RUNNING") {
      await expect(page.getByRole("button", { name: "상태 다시 확인" })).toBeEnabled();
      await expectTabFocus(page, page.getByRole("button", { name: "상태 다시 확인" }), "상태 다시 확인");
    }
    if (status === "FAILED") await expect(page.locator('.form-error[role="alert"]')).toContainText("TARGET_EXECUTION_FAILED: Target 실행을 완료하지 못했습니다.");
  });
}

test("Quality Gate PASS remains visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Gate 상태 조합은 대표 viewport에서 검증합니다.");
  await mockDetail(page, { gateStatus: "PASS" });
  await open(page);
  await expect(page.getByRole("region", { name: "Basic Quality Gate" }).getByText("PASS", { exact: true }).first()).toBeVisible();
});

for (const failure of ["targetFailure", "evaluatorFailure"] as const) {
  test(`${failure} preserves the remaining metadata`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "부분 오류는 대표 viewport에서 검증합니다.");
    await mockDetail(page, { [failure]: true });
    await open(page);
    await expect(page.getByRole("heading", { name: "실행 구성" })).toBeVisible();
    await expect(page.getByText(failure === "targetFailure" ? "Target metadata failure" : "Evaluator metadata failure")).toBeVisible();
    await expect(page.getByText(failure === "targetFailure" ? /Contains Evaluator · Version 4/ : /Mock Target · Version 2/)).toBeVisible();
  });
}

test("Result failure retries without hiding the Experiment", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "부분 오류는 대표 viewport에서 검증합니다.");
  await mockDetail(page, { resultFailureOnce: true });
  await open(page);
  await expect(page.getByText("Result 조회 실패")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator(".result-card")).toHaveCount(3);
});

test("Experiment failure keeps the recovery page contract", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "초기 오류는 대표 viewport에서 검증합니다.");
  await mockDetail(page, { experimentFailure: true });
  await page.goto(`/projects/${ids.project}/experiments/${ids.experiment}`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Experiment test failure")).toBeVisible();
  await expect(page.getByRole("link", { name: "History로 돌아가기" })).toBeVisible();
});
