import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";

type RecordValue = Record<string, unknown>;
let projectId: string;

function envelope(data: unknown[], total: number, page: number) {
  return { data, meta: { request_id: "b2-1", pagination: { total, page, size: 20 } } };
}

function project(index: number) {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `30000000-0000-4000-8000-${suffix}`,
    slug: `phase-b2-project-${index}`,
    name: `Phase B2 Project ${index}`,
    description: null,
    is_active: true,
    created_at: "2026-07-21T12:00:00Z",
    updated_at: "2026-07-21T12:00:00Z",
  };
}

function history(index: number) {
  const suffix = String(index).padStart(12, "0");
  return {
    experiment_id: `40000000-0000-4000-8000-${suffix}`,
    dataset_version_id: "40000000-0000-4000-8000-000000000101",
    target_version_id: "40000000-0000-4000-8000-000000000102",
    evaluator_version_id: "40000000-0000-4000-8000-000000000103",
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

function pageOf(route: Route) {
  return Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
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
      issues.push(`http: ${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (request.method() === "GET" && failure.includes("ERR_ABORTED")) {
      aborts.push({ url: request.url(), order: ++order });
    } else {
      issues.push(`requestfailed: ${failure} ${request.url()}`);
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

async function quality(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const result = await page.evaluate(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let clipped = false;
    if (focused && focused !== document.body) {
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
    )).some((element) => element.getBoundingClientRect().width > 0);
    return {
      overflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth),
      clipped,
      overlay,
    };
  });
  expect(result).toEqual({ overflow: 0, clipped: false, overlay: false });
}

async function tabTo(page: Page, selector: string) {
  const target = page.locator(selector);
  for (let index = 0; index < 120; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element)) return target;
  }
  throw new Error(`Tab did not reach ${selector}`);
}

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const response = await request.get("/api/backend/projects?page=1&size=20");
  expect(response.status()).toBe(200);
  const payload = await response.json() as RecordValue;
  const projects = payload.data as RecordValue[];
  const demo = projects.find((item) => item.name === "EvalOps Demo Project");
  if (typeof demo?.id !== "string") throw new Error("Demo project not found");
  projectId = demo.id;
  expect((await request.get(`/projects/${projectId}/history`)).status()).toBe(200);
});

test("Projects preserves 0/1/20/21/41 item pagination contracts", async ({ page }) => {
  const observation = observe(page);
  let total = 0;
  let release: (() => void) | undefined;
  let delayed = false;
  const requests: number[] = [];
  await page.route("**/api/backend/projects?**", async (route) => {
    const requestedPage = pageOf(route);
    requests.push(requestedPage);
    if (delayed && requestedPage === 3) {
      await new Promise<void>((resolve) => { release = resolve; });
    }
    const start = (requestedPage - 1) * 20 + 1;
    const count = Math.max(0, Math.min(20, total - start + 1));
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(Array.from({ length: count }, (_, i) => project(start + i)), total, requestedPage)) });
  });

  for (const count of [0, 1, 20]) {
    total = count;
    await page.goto("/projects");
    const pagination = page.getByRole("navigation", { name: "Projects pagination" });
    if (count === 0) {
      await expect(pagination).toHaveCount(0);
    } else {
      await expect(pagination).toContainText(`전체 ${count}건 · 1 / 1 페이지`);
      await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
      await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
    }
  }

  total = 21;
  await page.goto("/projects");
  const pagination = page.getByRole("navigation", { name: "Projects pagination" });
  const next = await tabTo(page, "nav[aria-label='Projects pagination'] button:last-child");
  await page.keyboard.press("Enter");
  await expect(pagination).toContainText("2 / 2 페이지");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeEnabled();
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();

  total = 41;
  await page.goto("/projects");
  await pagination.getByRole("button", { name: "다음" }).click();
  await expect(pagination).toContainText("2 / 3 페이지");
  delayed = true;
  await tabTo(page, "nav[aria-label='Projects pagination'] button:last-child");
  await page.keyboard.press("Space");
  await expect(pagination.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.keyboard.press("Space");
  expect(requests.filter((value) => value === 3)).toHaveLength(1);
  release?.();
  await expect(pagination).toContainText("3 / 3 페이지");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(next).not.toBeFocused();
  await quality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});

test("History preserves canonicalization, URL state, Empty, and shared controls", async ({ page }) => {
  const observation = observe(page);
  const requested: number[] = [];
  await page.route(`**/api/backend/projects/${projectId}/experiment-history?**`, async (route) => {
    const requestedPage = pageOf(route);
    requested.push(requestedPage);
    const total = requestedPage === 1 && new URL(route.request().url()).searchParams.get("experiment_status") === "FAILED"
      ? 0 : 41;
    const data = total === 0 ? [] : [history(requestedPage)];
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(envelope(data, total, requestedPage)) });
  });
  await page.goto(`/projects/${projectId}/history?page=999&experiment_status=COMPLETED&sort=created_at_asc`);
  await expect(page).toHaveURL(/page=3/);
  await expect(page).toHaveURL(/experiment_status=COMPLETED/);
  const pagination = page.getByRole("navigation", { name: "History pagination" });
  await expect(pagination).toContainText("전체 41건 · 3 / 3 페이지");
  await expect(pagination.getByRole("button", { name: "다음" })).toBeDisabled();
  expect(requested.slice(0, 2)).toEqual([999, 3]);
  await page.waitForLoadState("networkidle");
  await page.goto(`/projects/${projectId}/history?experiment_status=FAILED`);
  await expect(page.getByRole("heading", { name: "조건에 맞는 History가 없습니다" })).toBeVisible();
  await expect(pagination).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await quality(page);
  observation.finalize();
  expect(observation.issues).toEqual([]);
});
