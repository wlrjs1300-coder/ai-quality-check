import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";

type JsonRecord = Record<string, unknown>;
type Seed = { projectId: string; datasetId: string; targetId: string; evaluatorId: string };

const asRecord = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as JsonRecord;
};

async function apiData(request: APIRequestContext, path: string): Promise<unknown> {
  const response = await request.get(path);
  expect(response.status(), `Seed discovery failed: ${path}`).toBe(200);
  return asRecord(await response.json(), path).data;
}

async function firstId(request: APIRequestContext, path: string, label: string): Promise<string> {
  const data = await apiData(request, path);
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${label} was not found`);
  const id = asRecord(data[0], `${label}[0]`).id;
  if (typeof id !== "string") throw new Error(`${label} ID is not a string`);
  return id;
}

async function discoverSeed(request: APIRequestContext): Promise<Seed> {
  const projects = await apiData(request, "/api/backend/projects?page=1&size=20");
  if (!Array.isArray(projects)) throw new Error("Project list data is not an array");
  const project = projects.map((value, index) => asRecord(value, `projects[${index}]`))
    .find((value) => value.name === "EvalOps Demo Project");
  if (!project || typeof project.id !== "string") throw new Error("EvalOps Demo Project was not found");
  const projectId = project.id;
  return {
    projectId,
    datasetId: await firstId(request, `/api/backend/projects/${projectId}/datasets?page=1&size=20`, "Dataset"),
    targetId: await firstId(request, `/api/backend/projects/${projectId}/targets?page=1&size=20`, "Target"),
    evaluatorId: await firstId(request, `/api/backend/projects/${projectId}/evaluators?page=1&size=20`, "Evaluator"),
  };
}

function envelope(data: unknown[], total: number, page: number, size = 20) {
  return { data, meta: { request_id: "phase-b2-2a", pagination: { total, page, size } } };
}

function dataEnvelope(data: unknown) {
  return { data, meta: { request_id: "phase-b2-2a" } };
}

function pageOf(route: Route): number {
  return Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
}

function pageItems<T>(total: number, page: number, factory: (index: number) => T): T[] {
  const start = (page - 1) * 20 + 1;
  const count = Math.max(0, Math.min(20, total - start + 1));
  return Array.from({ length: count }, (_, index) => factory(start + index));
}

function evaluationCase(index: number) {
  return {
    id: `51000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    dataset_id: seed.datasetId,
    case_key: `phase-b2-2a-case-${index}`,
    question: `Phase B2-2A case ${index}`,
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

function datasetVersion(index: number) {
  return {
    id: `52000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    dataset_id: seed.datasetId,
    version: index,
    content_hash: `phase-b2-2a-dataset-${index}`,
    case_count: 5,
    created_at: "2026-07-21T12:00:00Z",
  };
}

function targetVersion(index: number) {
  return {
    id: `53000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    target_id: seed.targetId,
    version: index,
    content_hash: `phase-b2-2a-target-${index}`,
    config_snapshot: { fixed_response: { text: `response ${index}` } },
    response_strategy: "FIXED",
    latency_ms: 0,
    failure_rate: 0,
    created_at: "2026-07-21T12:00:00Z",
  };
}

function evaluatorVersion(index: number) {
  return {
    id: `54000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    evaluator_id: seed.evaluatorId,
    version: index,
    content_hash: `phase-b2-2a-evaluator-${index}`,
    evaluator_type_snapshot: "CONTAINS",
    config_snapshot: { expected: `expected ${index}`, case_sensitive: false },
    created_at: "2026-07-21T12:00:00Z",
  };
}

function observe(page: Page) {
  const issues: string[] = [];
  const successes = new Map<string, number[]>();
  const aborts: { url: string; order: number }[] = [];
  let order = 0;
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon.ico")) {
      issues.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.method() === "GET" && response.ok()) {
      const entries = successes.get(response.url()) ?? [];
      entries.push(++order);
      successes.set(response.url(), entries);
    } else if (response.status() >= 400 && new URL(response.url()).pathname !== "/favicon.ico") {
      issues.push(`http: ${response.status()} ${request.method()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (request.method() === "GET" && failure.includes("ERR_ABORTED")) {
      aborts.push({ url: request.url(), order: ++order });
    } else {
      issues.push(`requestfailed: ${failure} ${request.method()} ${request.url()}`);
    }
  });
  return {
    issues,
    finalize() {
      for (const abort of aborts) {
        if (!(successes.get(abort.url) ?? []).some((value) => value > abort.order)) {
          issues.push(`unrecovered-abort: GET ${abort.url}`);
        }
      }
    },
  };
}

async function expectQuality(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const result = await page.evaluate(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let clipped = false;
    if (focused && focused !== document.body && focused !== document.documentElement) {
      const rect = focused.getBoundingClientRect();
      const style = getComputedStyle(focused);
      const expansion = (Number.parseFloat(style.outlineWidth) || 0)
        + Math.max(Number.parseFloat(style.outlineOffset) || 0, 0);
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? innerWidth);
      const bottom = top + (viewport?.height ?? innerHeight);
      clipped = rect.left - expansion < left - 1 || rect.top - expansion < top - 1
        || rect.right + expansion > right + 1 || rect.bottom + expansion > bottom + 1;
    }
    const overlay = Array.from(document.querySelectorAll<HTMLElement>(
      "nextjs-portal [role='dialog'], [data-nextjs-dialog], [data-next-badge-root]",
    )).some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    return {
      overflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
      clipped,
      overlay,
    };
  });
  expect(result).toEqual({ overflow: 0, clipped: false, overlay: false });
}

async function tabTo(page: Page, selector: string) {
  const target = page.locator(selector);
  await expect(target).toBeVisible();
  for (let index = 0; index < 140; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) return target;
  }
  throw new Error(`Tab did not reach ${selector}`);
}

async function assertCountContract(page: Page, routePath: string, ariaLabel: string, setTotal: (value: number) => void) {
  for (const total of [0, 1, 20]) {
    setTotal(total);
    await page.goto(routePath);
    await page.waitForLoadState("networkidle");
    const pagination = page.getByRole("navigation", { name: ariaLabel });
    if (total === 0) {
      await expect(pagination).toHaveCount(0);
    } else {
      await expect(pagination).toContainText(`전체 ${total}건 · 1 / 1 페이지`);
      await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
      await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
    }
  }
  setTotal(21);
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  const pagination = page.getByRole("navigation", { name: ariaLabel });
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("2 / 2 페이지");
}

let seed: Seed;

test.beforeAll(async ({ request }) => {
  seed = await discoverSeed(request);
  for (const path of [
    `/projects/${seed.projectId}/datasets/${seed.datasetId}`,
    `/projects/${seed.projectId}/targets/${seed.targetId}`,
    `/projects/${seed.projectId}/evaluators/${seed.evaluatorId}`,
  ]) {
    expect((await request.get(path)).status(), `Route warmup failed: ${path}`).toBe(200);
  }
});

test("Dataset Evaluation Cases preserve shared pagination contracts", async ({ page }) => {
  const observation = observe(page);
  let total = 0;
  let forceResponsePage = false;
  let release: (() => void) | undefined;
  let delayPage3 = false;
  const requested: number[] = [];
  await page.route(`**/api/backend/datasets/${seed.datasetId}/evaluation-cases?**`, async (route) => {
    const requestPage = pageOf(route);
    requested.push(requestPage);
    if (delayPage3 && requestPage === 3) await new Promise<void>((resolve) => { release = resolve; });
    const responsePage = forceResponsePage && requestPage === 2 ? 999 : requestPage;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(pageItems(total, requestPage, evaluationCase), total, responsePage)) });
  });
  await page.route(`**/api/backend/datasets/${seed.datasetId}/versions?**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope([datasetVersion(1)], 1, 1)) });
  });

  const routePath = `/projects/${seed.projectId}/datasets/${seed.datasetId}`;
  await assertCountContract(page, routePath, "Evaluation cases pagination", (value) => { total = value; });
  total = 41;
  forceResponsePage = true;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  const pagination = page.getByRole("navigation", { name: "Evaluation cases pagination" });
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("3 / 3 페이지");
  await expect.poll(() => requested.at(-1)).toBe(3);
  expect(requested.slice(-3)).toEqual([2, 999, 3]);

  forceResponsePage = false;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  await pagination.getByRole("button", { name: "다음" }).click();
  delayPage3 = true;
  await tabTo(page, "nav[aria-label='Evaluation cases pagination'] button:last-child");
  await page.keyboard.press("Shift+Tab");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeFocused();
  await page.keyboard.press("Tab");
  const page3RequestsBeforeActivation = requested.filter((value) => value === 3).length;
  await page.keyboard.press("Space");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Space");
  expect(requested.filter((value) => value === 3)).toHaveLength(page3RequestsBeforeActivation + 1);
  release?.();
  await expect(pagination).toContainText("3 / 3 페이지");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expectQuality(page);
  await expect(page.getByRole("navigation", { name: "Pagination", exact: true })).toHaveCount(0);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

test("Dataset Versions clamp independently and creation returns to page 1", async ({ page }) => {
  const observation = observe(page);
  let total = 0;
  let forceResponsePage = false;
  let created = false;
  let delayPage3 = false;
  let release: (() => void) | undefined;
  const requested: number[] = [];
  await page.route(`**/api/backend/datasets/${seed.datasetId}/evaluation-cases?**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(pageItems(41, 1, evaluationCase), 41, 1)) });
  });
  await page.route(`**/api/backend/datasets/${seed.datasetId}/versions?**`, async (route) => {
    const requestPage = pageOf(route);
    requested.push(requestPage);
    if (delayPage3 && requestPage === 3) await new Promise<void>((resolve) => { release = resolve; });
    const responsePage = forceResponsePage && requestPage === 2 ? 999 : requestPage;
    const items = created && requestPage === 1
      ? [datasetVersion(999), ...pageItems(Math.max(total - 1, 0), 1, datasetVersion)].slice(0, 20)
      : pageItems(total, requestPage, datasetVersion);
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(items, total, responsePage)) });
  });
  await page.route(`**/api/backend/datasets/${seed.datasetId}/versions`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    created = true;
    await route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify(dataEnvelope(datasetVersion(999))) });
  });

  const routePath = `/projects/${seed.projectId}/datasets/${seed.datasetId}`;
  await assertCountContract(page, routePath, "Dataset versions pagination", (value) => { total = value; });
  total = 41;
  forceResponsePage = true;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  const pagination = page.getByRole("navigation", { name: "Dataset versions pagination" });
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("3 / 3 페이지");
  await expect.poll(() => requested.at(-1)).toBe(3);
  expect(requested.slice(-3)).toEqual([2, 999, 3]);

  forceResponsePage = false;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("2 / 3 페이지");
  await page.getByRole("button", { name: "Version 생성" }).click();
  await expect(pagination).toContainText("1 / 3 페이지");
  await expect(page.getByRole("heading", { level: 3, name: "Version 999" })).toBeVisible();
  expect(requested.at(-1)).toBe(1);

  created = false;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(page.getByRole("navigation", { name: "Evaluation cases pagination" }))
    .toContainText("1 / 3 페이지");
  delayPage3 = true;
  const next = await tabTo(page, "nav[aria-label='Dataset versions pagination'] button:last-child");
  await page.keyboard.press("Shift+Tab");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  const page3RequestsBeforeActivation = requested.filter((value) => value === 3).length;
  await page.keyboard.press("Space");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Space");
  expect(requested.filter((value) => value === 3)).toHaveLength(page3RequestsBeforeActivation + 1);
  release?.();
  await expect(pagination).toContainText("3 / 3 페이지");
  await expectQuality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

type VersionKind = "target" | "evaluator";

async function exerciseVersionDetail(page: Page, kind: VersionKind) {
  const observation = observe(page);
  const id = kind === "target" ? seed.targetId : seed.evaluatorId;
  const label = kind === "target" ? "Target versions pagination" : "Evaluator versions pagination";
  const factory: (index: number) => unknown = kind === "target" ? targetVersion : evaluatorVersion;
  const routePath = `/projects/${seed.projectId}/${kind}s/${id}`;
  let total = 0;
  let forceResponsePage = false;
  let created = false;
  let release: (() => void) | undefined;
  let delayPage3 = false;
  const requested: number[] = [];

  await page.route(`**/api/backend/${kind}s/${id}/versions?**`, async (route) => {
    const requestPage = pageOf(route);
    requested.push(requestPage);
    if (delayPage3 && requestPage === 3) await new Promise<void>((resolve) => { release = resolve; });
    const responsePage = forceResponsePage && requestPage === 2 ? 999 : requestPage;
    const items = created && requestPage === 1
      ? [factory(999), ...pageItems(Math.max(total - 1, 0), 1, factory)].slice(0, 20)
      : pageItems(total, requestPage, factory);
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(items, total, responsePage)) });
  });
  await page.route(`**/api/backend/${kind}s/${id}/versions`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    created = true;
    await route.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify(dataEnvelope(factory(999))) });
  });

  await assertCountContract(page, routePath, label, (value) => { total = value; });
  total = 41;
  forceResponsePage = true;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  const pagination = page.getByRole("navigation", { name: label });
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("999 / 3 페이지");
  await pagination.getByRole("button", { name: "이전" }).click();
  await expect(pagination).toContainText("3 / 3 페이지");
  expect(requested.slice(-3)).toEqual([2, 998, 3]);

  forceResponsePage = false;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("2 / 3 페이지");
  await page.getByRole("button", { name: "Version 생성" }).click();
  await expect(pagination).toContainText("1 / 3 페이지");
  await expect(page.getByText("Version 999", { exact: false })).toBeVisible();
  expect(requested.at(-1)).toBe(1);

  created = false;
  await page.goto(routePath);
  await page.waitForLoadState("networkidle");
  await pagination.getByRole("button", { name: "다음" }).click();
  delayPage3 = true;
  const next = await tabTo(page, `nav[aria-label='${label}'] button:last-child`);
  await page.keyboard.press("Shift+Tab");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  const page3RequestsBeforeActivation = requested.filter((value) => value === 3).length;
  await page.keyboard.press("Enter");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Enter");
  expect(requested.filter((value) => value === 3)).toHaveLength(page3RequestsBeforeActivation + 1);
  release?.();
  await expect(pagination).toContainText("3 / 3 페이지");
  await expectQuality(page);
  await expect(page.getByRole("navigation", { name: "Pagination", exact: true })).toHaveCount(0);
  observation.finalize();
  expect(observation.issues).toEqual([]);
}

test("Target Versions preserve pagination, clamp, loading, and creation contracts", async ({ page }) => {
  await exerciseVersionDetail(page, "target");
});

test("Evaluator Versions preserve pagination, clamp, loading, and creation contracts", async ({ page }) => {
  await exerciseVersionDetail(page, "evaluator");
});
