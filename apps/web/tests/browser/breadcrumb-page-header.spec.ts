import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

type SeedRoutes = {
  projectId: string;
  projectName: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: number;
  targetId: string;
  targetName: string;
  targetVersion: number;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorVersion: number;
  experimentId: string;
  comparisonId: string;
};

type RouteContract = {
  name: string;
  path: string;
  heading: string;
  breadcrumb: readonly { label: string; href?: string }[];
  actionHrefs?: readonly string[];
};

const record = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as JsonRecord;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} is not a string`);
  return value;
};

const number = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} is not a finite number`);
  }
  return value;
};

async function data(request: APIRequestContext, path: string): Promise<unknown> {
  const response = await request.get(path);
  expect(response.status(), `Seed discovery failed: ${path}`).toBe(200);
  return record(await response.json(), path).data;
}

async function first(request: APIRequestContext, path: string): Promise<JsonRecord> {
  const value = await data(request, path);
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Seed discovery returned no items: ${path}`);
  }
  return record(value[0], `${path}[0]`);
}

async function discoverSeed(request: APIRequestContext): Promise<SeedRoutes> {
  const projectsValue = await data(request, "/api/backend/projects?page=1&size=20");
  if (!Array.isArray(projectsValue)) throw new Error("Project list data is not an array");
  const project = projectsValue
    .map((value, index) => record(value, `projects[${index}]`))
    .find((value) => value.name === "EvalOps Demo Project");
  if (!project) throw new Error("EvalOps Demo Project was not found through the projects API");

  const projectId = string(project.id, "project.id");
  const dataset = await first(request, `/api/backend/projects/${projectId}/datasets?page=1&size=20`);
  const target = await first(request, `/api/backend/projects/${projectId}/targets?page=1&size=20`);
  const evaluator = await first(request, `/api/backend/projects/${projectId}/evaluators?page=1&size=20`);
  const datasetId = string(dataset.id, "dataset.id");
  const targetId = string(target.id, "target.id");
  const evaluatorId = string(evaluator.id, "evaluator.id");
  const datasetVersion = await first(request, `/api/backend/datasets/${datasetId}/versions?page=1&size=20`);
  const targetVersion = await first(request, `/api/backend/targets/${targetId}/versions?page=1&size=20`);
  const evaluatorVersion = await first(request, `/api/backend/evaluators/${evaluatorId}/versions?page=1&size=20`);
  const history = await first(request, `/api/backend/projects/${projectId}/experiment-history?page=1&size=20&sort=created_at_desc`);
  const comparison = record(history.baseline_comparison, "history.baseline_comparison");

  return {
    projectId,
    projectName: string(project.name, "project.name"),
    datasetId,
    datasetName: string(dataset.name, "dataset.name"),
    datasetVersion: number(datasetVersion.version, "datasetVersion.version"),
    targetId,
    targetName: string(target.name, "target.name"),
    targetVersion: number(targetVersion.version, "targetVersion.version"),
    evaluatorId,
    evaluatorName: string(evaluator.name, "evaluator.name"),
    evaluatorVersion: number(evaluatorVersion.version, "evaluatorVersion.version"),
    experimentId: string(history.experiment_id, "history.experiment_id"),
    comparisonId: string(comparison.comparison_id, "comparison.comparison_id"),
  };
}

function contracts(seed: SeedRoutes): RouteContract[] {
  const projectPath = `/projects/${seed.projectId}`;
  const datasetPath = `${projectPath}/datasets/${seed.datasetId}`;
  const targetPath = `${projectPath}/targets/${seed.targetId}`;
  const evaluatorPath = `${projectPath}/evaluators/${seed.evaluatorId}`;
  const historyPath = `${projectPath}/history`;

  return [
    {
      name: "projects",
      path: "/projects",
      heading: "Projects",
      breadcrumb: [],
    },
    {
      name: "project-overview",
      path: projectPath,
      heading: seed.projectName,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview" },
      ],
      actionHrefs: ["/projects", historyPath, `${projectPath}/experiments/new`],
    },
    {
      name: "dataset",
      path: datasetPath,
      heading: seed.datasetName,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.datasetName },
      ],
    },
    {
      name: "dataset-version",
      path: `${datasetPath}/versions/${seed.datasetVersion}`,
      heading: `Dataset Version ${seed.datasetVersion}`,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.datasetName, href: datasetPath },
        { label: `Version ${seed.datasetVersion}` },
      ],
    },
    {
      name: "target",
      path: targetPath,
      heading: seed.targetName,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.targetName },
      ],
    },
    {
      name: "target-version",
      path: `${targetPath}/versions/${seed.targetVersion}`,
      heading: `Target Version ${seed.targetVersion}`,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.targetName, href: targetPath },
        { label: `Version ${seed.targetVersion}` },
      ],
    },
    {
      name: "evaluator",
      path: evaluatorPath,
      heading: seed.evaluatorName,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.evaluatorName },
      ],
    },
    {
      name: "evaluator-version",
      path: `${evaluatorPath}/versions/${seed.evaluatorVersion}`,
      heading: `Evaluator Version ${seed.evaluatorVersion}`,
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: seed.evaluatorName, href: evaluatorPath },
        { label: `Version ${seed.evaluatorVersion}` },
      ],
    },
    {
      name: "experiment-new",
      path: `${projectPath}/experiments/new`,
      heading: "Experiment 생성",
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: "New Experiment" },
      ],
    },
    {
      name: "experiment",
      path: `${projectPath}/experiments/${seed.experimentId}`,
      heading: "Experiment 상세",
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: "History", href: historyPath },
        { label: "Experiment" },
      ],
      actionHrefs: [historyPath],
    },
    {
      name: "history",
      path: historyPath,
      heading: "History",
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: "History" },
      ],
    },
    {
      name: "comparison",
      path: `${projectPath}/comparisons/${seed.comparisonId}`,
      heading: "Comparison 상세",
      breadcrumb: [
        { label: "Projects", href: "/projects" },
        { label: "Project Overview", href: projectPath },
        { label: "History", href: historyPath },
        { label: "Comparison" },
      ],
      actionHrefs: [historyPath, projectPath],
    },
  ];
}

function observeBrowserIssues(page: Page): { issues: string[]; finalize: () => void } {
  const issues: string[] = [];
  const successfulGets = new Map<string, number[]>();
  const abortedGets: { url: string; sequence: number }[] = [];
  let sequence = 0;

  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location().url;
    const favicon = message.text().includes("404")
      && url.length > 0
      && new URL(url).pathname === "/favicon.ico";
    if (!favicon) issues.push(`console: ${message.text()} @ ${url}`);
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
    finalize: () => {
      for (const aborted of abortedGets) {
        const recovered = (successfulGets.get(aborted.url) ?? [])
          .some((responseSequence) => responseSequence > aborted.sequence);
        if (!recovered) issues.push(`unrecovered-abort: GET ${aborted.url}`);
      }
    },
  };
}

async function expectKeyboardAccess(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  let reached = false;
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press("Tab");
    reached = await target.evaluate((element) => document.activeElement === element);
    if (reached) break;
  }
  expect(reached, `Keyboard did not reach ${selector}`).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(target).toBeFocused();
}

async function expectLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const selectors = [".page-header h1", ".page-description", ".page-header-metadata"];
    return {
      overflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
      clipped: selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map(() => selector)),
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.clipped).toEqual([]);
}

async function expectNoVisibleOverlay(page: Page): Promise<void> {
  const visible = await page.evaluate(() => {
    const selectors = [
      "nextjs-portal [role='dialog']",
      "[data-nextjs-dialog]",
      "[data-next-badge-root]",
    ];
    return selectors.some((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .some((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }));
  });
  expect(visible).toBe(false);
}

let seed: SeedRoutes;

test.beforeAll(async ({ request }) => {
  seed = await discoverSeed(request);
});

test.describe("Phase B1 product routes", () => {
  test("discovered route inventory contains 12 product routes", () => {
    expect(contracts(seed)).toHaveLength(12);
  });

  for (let index = 0; index < 12; index += 1) {
    test(`product route ${index + 1} satisfies breadcrumb and PageHeader contracts`, async ({ page }) => {
      const contract = contracts(seed)[index];
      const observation = observeBrowserIssues(page);
      await page.goto(contract.path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(contract.heading);

      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
      if (contract.breadcrumb.length === 0) {
        await expect(breadcrumb).toHaveCount(0);
        await expectKeyboardAccess(page, ".page-header button, .page-header a");
      } else {
        await expect(breadcrumb).toHaveCount(1);
        const items = breadcrumb.locator(".breadcrumb-item");
        await expect(items).toHaveCount(contract.breadcrumb.length);
        for (let itemIndex = 0; itemIndex < contract.breadcrumb.length; itemIndex += 1) {
          const expected = contract.breadcrumb[itemIndex];
          const item = items.nth(itemIndex);
          await expect(item.locator(".breadcrumb-label")).toHaveText(expected.label);
          if (expected.href) {
            await expect(item.locator("a")).toHaveAttribute("href", expected.href);
          }
        }
        await expect(items.last().locator("[aria-current='page']")).toHaveCount(1);
        const separators = breadcrumb.locator(".breadcrumb-separator");
        await expect(separators).toHaveCount(contract.breadcrumb.length - 1);
        for (let separatorIndex = 0; separatorIndex < contract.breadcrumb.length - 1; separatorIndex += 1) {
          await expect(separators.nth(separatorIndex)).toHaveAttribute("aria-hidden", "true");
        }
        await expectKeyboardAccess(page, ".breadcrumb a");
      }

      if (contract.actionHrefs) {
        const actions = page.locator(".page-header .header-actions a");
        await expect(actions).toHaveCount(contract.actionHrefs.length);
        for (let actionIndex = 0; actionIndex < contract.actionHrefs.length; actionIndex += 1) {
          await expect(actions.nth(actionIndex)).toHaveAttribute("href", contract.actionHrefs[actionIndex]);
        }
      }

      if (contract.name === "projects") {
        await page.getByRole("button", { name: "+ Project" }).click();
        await expect(page.getByRole("heading", { name: "Project 생성", level: 2 })).toBeVisible();
        await page.getByRole("button", { name: "닫기" }).click();
        await expect(page.getByRole("heading", { name: "Project 생성", level: 2 })).toHaveCount(0);
      }

      if (contract.name === "history") {
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "CSV 다운로드" }).click();
        await expect((await download).suggestedFilename()).toMatch(/\.csv$/);
      }

      await expectLayout(page);
      await expectNoVisibleOverlay(page);
      await page.waitForTimeout(100);
      observation.finalize();
      expect(observation.issues).toEqual([]);
    });
  }
});

test("long unbroken Project title wraps at 390px without clipping", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Long-title scenario is measured at 390px");
  const longName = "EvalOpsVeryLongUnbrokenProjectTitle".repeat(8);
  await page.route(`**/api/backend/projects/${seed.projectId}`, async (route) => {
    const response = await route.fetch();
    const body = record(await response.json(), "project detail response");
    const project = record(body.data, "project detail data");
    await route.fulfill({
      response,
      json: { ...body, data: { ...project, name: longName } },
    });
  });
  await page.goto(`/projects/${seed.projectId}`);
  await expect(page.locator("h1")).toHaveText(longName);
  await expectLayout(page);
});

test("resource 404 keeps fallback h1, ErrorState h2, and keyboard recovery", async ({ page }) => {
  const missingProjectId = "00000000-0000-0000-0000-000000000000";
  await page.goto(`/projects/${missingProjectId}`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Project Overview");
  await expect(page.locator(".state-panel h2")).toHaveCount(1);
  const recovery = page.getByRole("link", { name: "Projects로 돌아가기" });
  await expect(recovery).toHaveAttribute("href", "/projects");
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  await expectKeyboardAccess(page, "a[href='/projects']");
  await recovery.click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("global not-found exposes one h1 and Projects recovery", async ({ page }) => {
  await page.goto("/phase-b1-unknown-route");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("페이지를 찾을 수 없습니다");
  const recovery = page.getByRole("link", { name: "Projects로 돌아가기" });
  await expect(recovery).toHaveAttribute("href", "/projects");
  await expectKeyboardAccess(page, "a[href='/projects']");
  await recovery.click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("disabled runtime-validation uses the global 404 contract", async ({ page }) => {
  const response = await page.goto("/runtime-validation");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("페이지를 찾을 수 없습니다");
  await expect(page.getByRole("link", { name: "Projects로 돌아가기" })).toHaveAttribute("href", "/projects");
});
