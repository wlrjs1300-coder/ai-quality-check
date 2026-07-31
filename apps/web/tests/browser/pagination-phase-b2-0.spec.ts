import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";

type JsonRecord = Record<string, unknown>;
type Seed = { projectId: string; datasetId: string };

const record = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as JsonRecord;
};

async function apiData(request: APIRequestContext, path: string): Promise<unknown> {
  const response = await request.get(path);
  expect(response.status(), `Seed discovery failed: ${path}`).toBe(200);
  return record(await response.json(), path).data;
}

async function discoverSeed(request: APIRequestContext): Promise<Seed> {
  const projects = await apiData(request, "/api/backend/projects?page=1&size=20");
  if (!Array.isArray(projects)) throw new Error("Project list data is not an array");
  const project = projects
    .map((value, index) => record(value, `projects[${index}]`))
    .find((value) => value.name === "EvalOps Demo Project");
  if (!project || typeof project.id !== "string") throw new Error("EvalOps Demo Project was not found");

  const datasets = await apiData(
    request,
    `/api/backend/projects/${project.id}/datasets?page=1&size=20`,
  );
  if (!Array.isArray(datasets) || datasets.length === 0) {
    throw new Error("Demo Dataset was not found");
  }
  const dataset = record(datasets[0], "datasets[0]");
  if (typeof dataset.id !== "string") throw new Error("Dataset ID is not a string");
  return { projectId: project.id, datasetId: dataset.id };
}

function listResponse(data: unknown[], total: number, page: number, size = 20) {
  return {
    data,
    meta: {
      request_id: "phase-b2-0",
      pagination: { total, page, size },
    },
  };
}

function historyItem(index: number) {
  const suffix = String(index).padStart(12, "0");
  return {
    experiment_id: `00000000-0000-4000-8000-${suffix}`,
    dataset_version_id: "00000000-0000-4000-8000-000000000101",
    target_version_id: "00000000-0000-4000-8000-000000000102",
    evaluator_version_id: "00000000-0000-4000-8000-000000000103",
    experiment_status: "COMPLETED",
    total_case_count: 5,
    passed_case_count: 5,
    failed_case_count: 0,
    error_case_count: 0,
    pass_rate: "1.0000",
    created_at: "2026-07-21T12:00:00Z",
    started_at: "2026-07-21T12:00:01Z",
    completed_at: "2026-07-21T12:00:02Z",
    quality_gate_result: null,
    baseline_comparison: null,
  };
}

function evaluationCase(datasetId: string, index: number) {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    dataset_id: datasetId,
    case_key: `phase-b2-case-${index}`,
    question: `Phase B2 case ${index}`,
    expected_summary: null,
    evidence: [],
    required_elements: [],
    forbidden_elements: [],
    tags: [],
    severity: "LOW",
    required_for_release: false,
    status: "DRAFT",
  };
}

function datasetVersion(datasetId: string, index: number) {
  return {
    id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    dataset_id: datasetId,
    version: index,
    content_hash: `phase-b2-content-hash-${index}`,
    case_count: 5,
    created_at: "2026-07-21T12:00:00Z",
  };
}

function pageNumber(route: Route): number {
  return Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
}

function observeBrowserIssues(page: Page) {
  const issues: string[] = [];
  const successfulGets = new Map<string, number[]>();
  const abortedGets: { url: string; sequence: number }[] = [];
  let sequence = 0;

  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    const favicon = message.text().includes("404")
      && location.length > 0
      && new URL(location).pathname === "/favicon.ico";
    if (!favicon) issues.push(`console: ${message.text()} @ ${location}`);
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.method() === "GET" && response.status() >= 200 && response.status() < 300) {
      const responses = successfulGets.get(response.url()) ?? [];
      responses.push(++sequence);
      successfulGets.set(response.url(), responses);
    }
    if (response.status() >= 400 && new URL(response.url()).pathname !== "/favicon.ico") {
      issues.push(`http: ${response.status()} ${request.method()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (request.method() === "GET" && failure.includes("ERR_ABORTED")) {
      abortedGets.push({ url: request.url(), sequence: ++sequence });
      return;
    }
    issues.push(`requestfailed: ${failure} ${request.method()} ${request.url()}`);
  });

  return {
    issues,
    finalize() {
      for (const aborted of abortedGets) {
        const recovered = (successfulGets.get(aborted.url) ?? [])
          .some((responseSequence) => responseSequence > aborted.sequence);
        if (!recovered) issues.push(`unrecovered-abort: GET ${aborted.url}`);
      }
    },
  };
}

async function expectQuality(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const result = await page.evaluate(() => {
    const overlaySelectors = [
      "nextjs-portal [role='dialog']",
      "[data-nextjs-dialog]",
      "[data-next-badge-root]",
    ];
    const visibleOverlay = overlaySelectors.some((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).some((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      }));
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let focusClipped = false;
    if (focused && focused !== document.body && focused !== document.documentElement) {
      const style = getComputedStyle(focused);
      const rect = focused.getBoundingClientRect();
      const width = Number.parseFloat(style.outlineWidth) || 0;
      const offset = Math.max(Number.parseFloat(style.outlineOffset) || 0, 0);
      const expansion = width + offset;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? window.innerWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      focusClipped = rect.left - expansion < left - 1
        || rect.top - expansion < top - 1
        || rect.right + expansion > right + 1
        || rect.bottom + expansion > bottom + 1;
    }
    return {
      overflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
      visibleOverlay,
      focusClipped,
    };
  });
  expect(result.overflow).toBe(0);
  expect(result.visibleOverlay).toBe(false);
  expect(result.focusClipped).toBe(false);
}

async function reachByTab(page: Page, selector: string) {
  const target = page.locator(selector);
  await expect(target).toBeVisible();
  for (let step = 0; step < 100; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) return target;
  }
  throw new Error(`Keyboard did not reach ${selector}`);
}

let seed: Seed;

test.beforeAll(async ({ request }) => {
  seed = await discoverSeed(request);
  const historyWarmup = await request.get(`/projects/${seed.projectId}/history`);
  expect(historyWarmup.status()).toBe(200);
});

test("History canonicalizes an out-of-range page and preserves filters", async ({ page }) => {
  const observation = observeBrowserIssues(page);
  const requestedPages: number[] = [];
  await page.route(`**/api/backend/projects/${seed.projectId}/experiment-history?**`, async (route) => {
    const url = new URL(route.request().url());
    const pageValue = Number(url.searchParams.get("page"));
    requestedPages.push(pageValue);
    expect(url.searchParams.get("size")).toBe("20");
    expect(url.searchParams.get("experiment_status")).toBe("COMPLETED");
    expect(url.searchParams.get("sort")).toBe("created_at_asc");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listResponse(pageValue === 3 ? [historyItem(41)] : [], 41, pageValue)),
    });
  });

  await page.goto(
    `/projects/${seed.projectId}/history?page=999&experiment_status=COMPLETED&sort=created_at_asc`,
  );
  await expect(page).toHaveURL(/page=3/);
  await expect(page).toHaveURL(/experiment_status=COMPLETED/);
  await expect(page).toHaveURL(/sort=created_at_asc/);
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(page.locator(".pagination")).toContainText("3 / 3 페이지");
  expect(requestedPages).toEqual([999, 3]);
  await page.waitForLoadState("networkidle");
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

test("History keeps page 1 and Empty state when total is zero", async ({ page }) => {
  const observation = observeBrowserIssues(page);
  let requests = 0;
  await page.route(`**/api/backend/projects/${seed.projectId}/experiment-history?**`, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listResponse([], 0, 1)),
    });
  });
  await page.goto(`/projects/${seed.projectId}/history`);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByRole("heading", { name: "조건에 맞는 History가 없습니다" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "History pagination" })).toHaveCount(0);
  expect(requests).toBe(1);
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

test("History keeps the last valid page without another request", async ({ page }) => {
  const observation = observeBrowserIssues(page);
  const requestedPages: number[] = [];
  await page.route(`**/api/backend/projects/${seed.projectId}/experiment-history?**`, async (route) => {
    const requestedPage = pageNumber(route);
    requestedPages.push(requestedPage);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listResponse([historyItem(41)], 41, requestedPage)),
    });
  });
  await page.goto(`/projects/${seed.projectId}/history?page=3`);
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(page).toHaveURL(/page=3/);
  expect(requestedPages).toEqual([3]);
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

async function installDatasetPages(page: Page, delayedKind: "cases" | "versions") {
  let release: (() => void) | undefined;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests = { cases: [] as number[], versions: [] as number[] };

  await page.route(`**/api/backend/datasets/${seed.datasetId}/evaluation-cases?**`, async (route) => {
    const requestedPage = pageNumber(route);
    requests.cases.push(requestedPage);
    if (delayedKind === "cases" && requestedPage === 2) await delayed;
    const start = (requestedPage - 1) * 20 + 1;
    const count = requestedPage === 3 ? 1 : 20;
    const items = Array.from({ length: count }, (_, index) =>
      evaluationCase(seed.datasetId, start + index));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listResponse(items, 41, requestedPage)),
    });
  });
  await page.route(`**/api/backend/datasets/${seed.datasetId}/versions?**`, async (route) => {
    const requestedPage = pageNumber(route);
    requests.versions.push(requestedPage);
    if (delayedKind === "versions" && requestedPage === 2) await delayed;
    const start = (requestedPage - 1) * 20 + 1;
    const count = requestedPage === 3 ? 1 : 20;
    const items = Array.from({ length: count }, (_, index) =>
      datasetVersion(seed.datasetId, start + index));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listResponse(items, 41, requestedPage)),
    });
  });
  return { requests, release: () => release?.() };
}

test("Evaluation Case pagination disables both buttons during keyboard navigation", async ({ page }) => {
  const observation = observeBrowserIssues(page);
  const control = await installDatasetPages(page, "cases");
  await page.goto(`/projects/${seed.projectId}/datasets/${seed.datasetId}`);

  const cases = page.getByRole("navigation", { name: "Evaluation cases pagination" });
  const versions = page.getByRole("navigation", { name: "Dataset versions pagination" });
  await expect(cases).toBeVisible();
  await expect(versions).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pagination", exact: true })).toHaveCount(0);

  const next = await reachByTab(page, "nav[aria-label='Evaluation cases pagination'] button:last-child");
  await page.keyboard.press("Enter");
  await expect(cases.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(cases.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Enter");
  expect(control.requests.cases.filter((value) => value === 2)).toHaveLength(1);
  control.release();
  await expect(cases).toContainText("2 / 3");
  await expect(cases.getByRole("button", { name: "이전" })).toBeEnabled();
  await expect(cases.getByRole("button", { name: "다음" })).toBeEnabled();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(next).toBeFocused();
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

test("Dataset Version pagination disables both buttons during Space activation", async ({ page }) => {
  const observation = observeBrowserIssues(page);
  const control = await installDatasetPages(page, "versions");
  await page.goto(`/projects/${seed.projectId}/datasets/${seed.datasetId}`);

  const versions = page.getByRole("navigation", { name: "Dataset versions pagination" });
  const next = await reachByTab(page, "nav[aria-label='Dataset versions pagination'] button:last-child");
  await page.keyboard.press("Space");
  await expect(versions.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(versions.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Space");
  expect(control.requests.versions.filter((value) => value === 2)).toHaveLength(1);
  control.release();
  await expect(versions).toContainText("2 / 3");
  await expect(versions.getByRole("button", { name: "이전" })).toBeEnabled();
  await expect(versions.getByRole("button", { name: "다음" })).toBeEnabled();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(next).toBeFocused();
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});
