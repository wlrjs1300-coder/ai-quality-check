import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const projectId = "11111111-1111-4111-8111-111111111111";
const experimentId = "22222222-2222-4222-8222-222222222222";
const comparisonId = "33333333-3333-4333-8333-333333333333";
const now = "2026-08-01T09:00:00Z";
const project = {
  project_id: projectId, slug: "release-demo", name: "Release Demo Project",
  description: "배포 전 품질 판정을 검증합니다.", is_active: true, created_at: now, updated_at: now,
};
const readiness = { status: "NOT_READY", reason_codes: ["GATE_BLOCK"], reason_summary: "Critical 실패로 배포가 차단되었습니다." };
const qualityGate = { result_id: "gate-result", policy_id: "gate-policy", status: "BLOCK", pass_rate: "0.90", reason_codes: ["CRITICAL_FAILURE"], created_at: now };
const comparison = { comparison_id: comparisonId, baseline_experiment_id: "baseline", current_experiment_id: experimentId, status: "REGRESSED", pass_rate_delta: "-0.05", reason_codes: ["PASS_RATE_REGRESSION"], created_at: now };
const metrics = {
  experiment_count: 8, pending_experiment_count: 0, running_experiment_count: 1,
  completed_experiment_count: 6, failed_experiment_count: 1, average_pass_rate: "0.88",
  first_pass_rate: "0.82", latest_pass_rate: "0.90", pass_rate_delta: "0.08",
  gate_pass_count: 5, gate_block_count: 1, gate_missing_count: 0,
  comparison_improved_count: 3, comparison_unchanged_count: 2,
  comparison_regressed_count: 1, comparison_missing_count: 0,
};

function envelope(data: unknown) {
  return { data, meta: { request_id: "overview-test" } };
}

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

function dashboard(gateStatus: "PASS" | "BLOCK" = "BLOCK", comparisonStatus: "IMPROVED" | "UNCHANGED" | "REGRESSED" = "REGRESSED") {
  return {
    project, period: { created_from: null, created_to: null },
    readiness: { ...readiness, status: gateStatus === "PASS" ? "READY" : "NOT_READY" },
    kpis: { ...metrics, latest_pass_rate: "0.90" },
    recent_experiments: [{
      experiment_id: experimentId, experiment_status: "COMPLETED", pass_rate: "0.90",
      total_case_count: 30, passed_case_count: 27, failed_case_count: 3, error_case_count: 0,
      created_at: now, completed_at: now, quality_gate_status: gateStatus,
      baseline_comparison_status: comparisonStatus,
    }],
    latest_quality_gate_result: { ...qualityGate, status: gateStatus },
    latest_baseline_comparison: { ...comparison, status: comparisonStatus },
    trend: { direction: "IMPROVING", first_pass_rate: "0.82", latest_pass_rate: "0.90", pass_rate_delta: "0.08", summary: "Pass Rate가 상승하고 있습니다." },
    warning_codes: gateStatus === "BLOCK" ? ["GATE_BLOCK_HISTORY_PRESENT"] : [],
  };
}

function summary() {
  return { project, period: { created_from: null, created_to: null }, readiness, summary: "현재 버전은 Release 조건을 충족하지 못했습니다.", metrics, latest_experiment: null, latest_quality_gate_result: qualityGate, latest_baseline_comparison: comparison, warning_codes: ["GATE_BLOCK_HISTORY_PRESENT"] };
}

function trend() {
  return { project_id: projectId, created_from: null, created_to: null, ...metrics, latest_experiment: null, latest_quality_gate_result: qualityGate, latest_baseline_comparison: comparison };
}

async function mockOverview(page: Page, failures: Set<"dashboard" | "summary" | "trend"> = new Set()) {
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/projects/${projectId}`)) {
      await json(route, envelope({ id: projectId, slug: project.slug, name: project.name, description: project.description, is_active: true, created_at: now, updated_at: now }));
    } else if (url.pathname.includes("dashboard-overview")) {
      await json(route, failures.has("dashboard") ? { error: { code: "TEST_FAILURE", message: "Dashboard test failure" }, meta: { request_id: "test" } } : envelope(dashboard()), failures.has("dashboard") ? 500 : 200);
    } else if (url.pathname.includes("summary-report")) {
      await json(route, failures.has("summary") ? { error: { code: "TEST_FAILURE", message: "Summary test failure" }, meta: { request_id: "test" } } : envelope(summary()), failures.has("summary") ? 500 : 200);
    } else if (url.pathname.includes("trend-summary")) {
      await json(route, failures.has("trend") ? { error: { code: "TEST_FAILURE", message: "Trend test failure" }, meta: { request_id: "test" } } : envelope(trend()), failures.has("trend") ? 500 : 200);
    } else if (/\/(datasets|targets|evaluators)$/.test(url.pathname)) {
      await json(route, { data: [], meta: { request_id: "test", pagination: { total: 0, page: 1, size: 20 } } });
    } else {
      await json(route, { error: { code: "UNEXPECTED_TEST_REQUEST", message: url.pathname }, meta: { request_id: "test" } }, 500);
    }
  });
}

async function openOverview(page: Page) {
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { level: 1, name: project.name })).toBeVisible();
}

async function tabToAction(page: Page, target: Locator, actionName: string) {
  await expect(target, `${actionName} 링크가 표시되어야 합니다.`).toBeVisible();

  for (let pressCount = 0; pressCount < 16; pressCount += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) {
      const outlineStyle = await target.evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(outlineStyle, `${actionName}의 focus-visible outline이 표시되어야 합니다.`).not.toBe("none");
      return;
    }
  }

  throw new Error(`${actionName}에 실제 Tab 이동으로 도달하지 못했습니다.`);
}

test("Release Decision hierarchy, links, responsive layout, and keyboard focus", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/backend/") && response.status() >= 400) failedResponses.push(response.url()); });
  await mockOverview(page);
  await openOverview(page);

  await expect(page.locator("h1")).toHaveCount(1);
  const headings = page.locator("main h2");
  await expect(headings.nth(0)).toHaveText("Release Decision");
  await expect(page.getByText("현재 버전은 Release 조건을 충족하지 못했습니다.")).toBeVisible();
  await expect(page.getByText("Quality Gate").locator("..").getByText("BLOCK", { exact: true })).toBeVisible();
  await expect(page.getByText("Comparison", { exact: true }).locator("..").getByText("REGRESSED", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /최신 Comparison 상세/ })).toHaveAttribute("href", `/projects/${projectId}/comparisons/${comparisonId}`);
  await expect(page.getByRole("link", { name: /Experiment 상세/ })).toHaveAttribute("href", `/projects/${projectId}/experiments/${experimentId}`);
  await expect(page.locator(".project-overview-kpi-grid .metric-card")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  const keyboardActions = [
    page.getByRole("link", { name: "Experiment 생성" }),
    page.getByRole("link", { name: "전체 History" }),
    page.getByRole("link", { name: "Projects로 돌아가기" }),
    page.getByRole("link", { name: /최신 Comparison 상세/ }),
  ];
  for (const action of keyboardActions) {
    await tabToAction(page, action, await action.innerText());
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test("period filter applies to analytics requests and resets the URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "동일 기능은 대표 viewport에서 검증합니다.");
  const analyticsQueries: string[] = [];
  await mockOverview(page);
  page.on("request", (request) => { if (/dashboard-overview|summary-report|trend-summary/.test(request.url())) analyticsQueries.push(new URL(request.url()).search); });
  await openOverview(page);
  await page.getByLabel("시작일").fill("2026-07-01");
  await page.getByLabel("종료일").fill("2026-07-31");
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page).toHaveURL(/from=2026-07-01&to=2026-07-31/);
  await expect.poll(() => analyticsQueries.filter((query) => query.includes("created_from") && query.includes("created_to")).length).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page).toHaveURL(`/projects/${projectId}`);
});

for (const failure of ["dashboard", "summary", "trend"] as const) {
  test(`${failure} failure preserves the other analytics`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "부분 오류는 대표 viewport에서 검증합니다.");
    await mockOverview(page, new Set([failure]));
    await openOverview(page);
    await expect(page.getByText(`${failure === "dashboard" ? "Dashboard" : failure === "summary" ? "Summary" : "Trend"}를 불러오지 못했습니다`)).toBeVisible();
    if (failure === "dashboard") await expect(page.getByText("현재 버전은 Release 조건을 충족하지 못했습니다.")).toBeVisible();
    if (failure === "summary") await expect(page.getByRole("heading", { name: "배포 준비 상태" })).toBeVisible();
    if (failure === "trend") await expect(page.getByRole("heading", { name: "핵심 KPI" })).toBeVisible();
  });
}

test("latest gate and Comparison semantic states remain visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "상태 조합은 대표 viewport에서 검증합니다.");
  let gate: "PASS" | "BLOCK" = "PASS";
  let comparisonStatus: "IMPROVED" | "UNCHANGED" | "REGRESSED" = "IMPROVED";
  await mockOverview(page);
  await page.route("**/api/backend/**/dashboard-overview**", async (route) => json(route, envelope(dashboard(gate, comparisonStatus))));
  await openOverview(page);
  for (const [nextGate, nextComparison] of [["PASS", "IMPROVED"], ["PASS", "UNCHANGED"], ["BLOCK", "REGRESSED"]] as const) {
    gate = nextGate;
    comparisonStatus = nextComparison;
    await page.reload();
    await expect(page.getByText("Quality Gate").locator("..").getByText(nextGate, { exact: true })).toBeVisible();
    await expect(page.getByText("Comparison", { exact: true }).locator("..").getByText(nextComparison, { exact: true })).toBeVisible();
  }
});
