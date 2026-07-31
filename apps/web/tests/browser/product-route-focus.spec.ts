import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
} from "@playwright/test";

// These deterministic IDs were discovered through the official demo seed APIs.
const seed = {
  projectId: "f555d12e-4708-506f-b9d9-0311105720c5",
  datasetId: "aedf9ea1-10e3-56d1-a45f-120e2550ec3b",
  experimentId: "4bc4a034-db3b-55f8-9153-46c201fa77c8",
  comparisonId: "3867438d-838a-5279-8956-c7b97ec55394",
} as const;

type ProductRoute = {
  name: string;
  path: string;
  heading: string;
};

const routes: ProductRoute[] = [
  { name: "projects", path: "/projects", heading: "Projects" },
  {
    name: "project-detail",
    path: `/projects/${seed.projectId}`,
    heading: "EvalOps Demo Project",
  },
  {
    name: "dataset-detail",
    path: `/projects/${seed.projectId}/datasets/${seed.datasetId}`,
    heading: "Synthetic Release Policy Evaluation",
  },
  {
    name: "experiment-create",
    path: `/projects/${seed.projectId}/experiments/new`,
    heading: "Experiment 생성",
  },
  {
    name: "experiment-detail",
    path: `/projects/${seed.projectId}/experiments/${seed.experimentId}`,
    heading: "Experiment 상세",
  },
  {
    name: "history",
    path: `/projects/${seed.projectId}/history`,
    heading: "History",
  },
  {
    name: "comparison-detail",
    path: `/projects/${seed.projectId}/comparisons/${seed.comparisonId}`,
    heading: "Comparison 상세",
  },
];

type BrowserIssue = {
  kind: string;
  detail: string;
};

type FocusStep = {
  key: string;
  tagName: string;
  role: string | null;
  type: string | null;
  href: string | null;
  ariaLabel: string | null;
  text: string;
  id: string;
  className: string;
  tabIndex: number;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  outlineColor: string;
  boxShadow: string;
  viewportWidth: number;
  viewportHeight: number;
  visualViewport: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  scrollX: number;
  scrollY: number;
  viewportClipped: boolean;
  clippedAncestors: string[];
  fixedObstructions: string[];
};

const focusableSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable='true']",
  "[tabindex]",
].join(",");

function requestLabel(request: Request): string {
  return `${request.method()} ${request.url()}`;
}

async function expectSeedApiPreflight(request: APIRequestContext) {
  const checks = [
    {
      path: `/api/backend/projects/${seed.projectId}`,
      expectedName: "EvalOps Demo Project",
      expectedProjectId: seed.projectId,
    },
    {
      path: `/api/backend/datasets/${seed.datasetId}`,
      expectedName: "Synthetic Release Policy Evaluation",
      expectedProjectId: seed.projectId,
    },
    {
      path: `/api/backend/experiments/${seed.experimentId}`,
      expectedName: null,
      expectedProjectId: null,
    },
    {
      path: `/api/backend/baseline-comparisons/${seed.comparisonId}`,
      expectedName: null,
      expectedProjectId: seed.projectId,
    },
  ];

  for (const check of checks) {
    const response = await request.get(check.path);
    expect(
      response.status(),
      `Seed API preflight failed: GET ${check.path}`,
    ).toBe(200);
    const payload = await response.json();
    expect(payload).toHaveProperty("data");
    if (check.expectedName) {
      expect(payload.data.name).toBe(check.expectedName);
    }
    if (check.expectedProjectId) {
      const actualProjectId =
        check.path.includes("/projects/") ? payload.data.id : payload.data.project_id;
      expect(actualProjectId).toBe(check.expectedProjectId);
    }
  }
}

async function visibleEnabledFocusableCount(page: Page): Promise<number> {
  return page.locator(focusableSelector).evaluateAll((elements) =>
    elements.filter((element) => {
      const htmlElement = element as HTMLElement;
      const control = element as HTMLButtonElement;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.closest("nextjs-portal") &&
        !control.disabled &&
        htmlElement.tabIndex >= 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length,
  );
}

async function waitForFocusScroll(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function readActiveFocusStep(page: Page): Promise<FocusStep | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (
      !(element instanceof HTMLElement) ||
      element === document.body ||
      element === document.documentElement ||
      element.tagName === "NEXTJS-PORTAL" ||
      element.closest("nextjs-portal")
    ) {
      return null;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
    const expansion = outlineWidth + Math.max(outlineOffset, 0);
    const visualViewport = window.visualViewport;
    const viewport = {
      left: visualViewport?.offsetLeft ?? 0,
      top: visualViewport?.offsetTop ?? 0,
      width: visualViewport?.width ?? window.innerWidth,
      height: visualViewport?.height ?? window.innerHeight,
    };
    const viewportRight = viewport.left + viewport.width;
    const viewportBottom = viewport.top + viewport.height;
    const focusRect = {
      left: rect.left - expansion,
      top: rect.top - expansion,
      right: rect.right + expansion,
      bottom: rect.bottom + expansion,
    };

    const describe = (value: Element): string => {
      const html = value as HTMLElement;
      const id = html.id ? `#${html.id}` : "";
      const className =
        typeof html.className === "string" && html.className.trim()
          ? `.${html.className.trim().split(/\s+/).join(".")}`
          : "";
      return `${value.tagName.toLowerCase()}${id}${className}`;
    };

    const path: string[] = [];
    let pathElement: Element | null = element;
    while (pathElement && pathElement !== document.documentElement) {
      const parent: Element | null = pathElement.parentElement;
      const index = parent
        ? Array.from(parent.children).indexOf(pathElement) + 1
        : 1;
      path.unshift(`${describe(pathElement)}:nth-child(${index})`);
      pathElement = parent;
    }

    const clippedAncestors: string[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const ancestorStyle = window.getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      const clipsX = ["hidden", "clip"].includes(ancestorStyle.overflowX);
      const clipsY = ["hidden", "clip"].includes(ancestorStyle.overflowY);
      const clippedX =
        clipsX &&
        (focusRect.left < ancestorRect.left - 1 ||
          focusRect.right > ancestorRect.right + 1);
      const clippedY =
        clipsY &&
        (focusRect.top < ancestorRect.top - 1 ||
          focusRect.bottom > ancestorRect.bottom + 1);
      if (clippedX || clippedY) {
        clippedAncestors.push(describe(ancestor));
      }
      ancestor = ancestor.parentElement;
    }

    const centerX = Math.min(
      window.innerWidth - 1,
      Math.max(0, rect.left + rect.width / 2),
    );
    const centerY = Math.min(
      window.innerHeight - 1,
      Math.max(0, rect.top + rect.height / 2),
    );
    const fixedObstructions = document
      .elementsFromPoint(centerX, centerY)
      .filter((candidate) => {
        if (
          candidate === element ||
          candidate.contains(element) ||
          element.contains(candidate)
        ) {
          return false;
        }
        const position = window.getComputedStyle(candidate).position;
        return position === "fixed" || position === "sticky";
      })
      .map(describe);

    const input = element as HTMLInputElement;
    const anchor = element as HTMLAnchorElement;
    const text = (element.innerText || input.value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);

    return {
      key: path.join(">"),
      tagName: element.tagName,
      role: element.getAttribute("role"),
      type: element.getAttribute("type"),
      href: anchor.href || null,
      ariaLabel: element.getAttribute("aria-label"),
      text,
      id: element.id,
      className:
        typeof element.className === "string" ? element.className : "",
      tabIndex: element.tabIndex,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      outlineStyle: style.outlineStyle,
      outlineWidth,
      outlineOffset,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      visualViewport: {
        ...viewport,
        right: viewportRight,
        bottom: viewportBottom,
      },
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportClipped:
        focusRect.left < viewport.left - 1 ||
        focusRect.top < viewport.top - 1 ||
        focusRect.right > viewportRight + 1 ||
        focusRect.bottom > viewportBottom + 1,
      clippedAncestors,
      fixedObstructions,
    };
  });
}

function expectFocusStep(step: FocusStep) {
  const identity = `${step.tagName} ${step.text || step.ariaLabel || step.id || step.key}`;
  const hasOutline =
    step.outlineStyle !== "none" && step.outlineWidth > 0;
  const hasBoxShadow =
    step.boxShadow !== "none" && step.boxShadow.trim().length > 0;
  expect(
    hasOutline || hasBoxShadow,
    `Missing focus indicator: ${identity}`,
  ).toBe(true);
  expect(step.viewportClipped, `Viewport focus clipping: ${identity}`).toBe(false);
  expect(
    step.clippedAncestors,
    `Overflow ancestor focus clipping: ${identity}`,
  ).toEqual([]);
  expect(
    step.fixedObstructions,
    `Fixed/sticky obstruction: ${identity}`,
  ).toEqual([]);
}

async function collectKeyboardFocusSteps(
  page: Page,
  initialStep: FocusStep,
): Promise<FocusStep[]> {
  const candidateCount = await visibleEnabledFocusableCount(page);
  expect(candidateCount, "The route has no visible enabled focusable element.").toBeGreaterThan(0);

  const steps: FocusStep[] = [initialStep];
  const seen = new Set<string>([initialStep.key]);
  const maximumSteps = candidateCount + 5;
  expectFocusStep(initialStep);

  for (let index = 0; index < maximumSteps; index += 1) {
    await page.keyboard.press("Tab");
    await waitForFocusScroll(page);
    const step = await readActiveFocusStep(page);
    if (!step) {
      continue;
    }
    if (seen.has(step.key)) continue;

    seen.add(step.key);
    steps.push(step);
    expectFocusStep(step);
  }

  expect(
    steps.length,
    `Keyboard traversal did not focus an interactive element (candidates=${candidateCount}).`,
  ).toBeGreaterThan(0);
  expect(
    steps.length,
    `Keyboard traversal exceeded its guard (candidates=${candidateCount}).`,
  ).toBeLessThanOrEqual(maximumSteps);

  return steps;
}

async function pressUntilProductFocus(
  page: Page,
  key: "Tab" | "Shift+Tab",
  maximumPresses: number,
): Promise<FocusStep | null> {
  for (let index = 0; index < maximumPresses; index += 1) {
    await page.keyboard.press(key);
    await waitForFocusScroll(page);
    const step = await readActiveFocusStep(page);
    if (step) return step;
  }
  return null;
}

async function expectInitialTabDeterminism(
  page: Page,
  maximumPresses: number,
): Promise<FocusStep> {
  const first = await pressUntilProductFocus(page, "Tab", maximumPresses);
  expect(first, "Tab did not reach the first product focus step.").not.toBeNull();

  const second = await pressUntilProductFocus(page, "Tab", maximumPresses);
  expect(second, "Tab did not reach the second product focus step.").not.toBeNull();
  expect(second?.key, "The second Tab repeated the first product focus step.").not.toBe(
    first?.key,
  );

  const backward = await pressUntilProductFocus(
    page,
    "Shift+Tab",
    maximumPresses,
  );
  expect(backward?.key, "Shift+Tab did not return to the first product focus step.").toBe(
    first?.key,
  );
  return first as FocusStep;
}

async function readLayoutIssues(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const horizontalOverflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const textClipping: string[] = [];
    const selectors = "h1,h2,h3,p,label,a,button,summary,[role='alert']";

    for (const element of document.querySelectorAll<HTMLElement>(selectors)) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;
      if (!visible) continue;

      const clipsX = ["hidden", "clip"].includes(style.overflowX);
      const clipsY = ["hidden", "clip"].includes(style.overflowY);
      if (
        (clipsX && element.scrollWidth > element.clientWidth + 1) ||
        (clipsY && element.scrollHeight > element.clientHeight + 1)
      ) {
        const label = `${element.tagName.toLowerCase()}#${element.id}.${element.className}`;
        textClipping.push(label);
      }
    }

    const overlayDetails: string[] = [];
    for (const portal of document.querySelectorAll("nextjs-portal")) {
      const rootNode = portal.shadowRoot;
      if (!rootNode) continue;
      for (const element of rootNode.querySelectorAll<HTMLElement>(
        "[role='dialog'], nextjs-errors-dialog, [data-nextjs-dialog-overlay]",
      )) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          overlayDetails.push(
            (element.innerText || element.tagName).replace(/\s+/g, " ").slice(0, 200),
          );
        }
      }
    }

    return { horizontalOverflow, textClipping, overlayDetails };
  });
}

test.beforeAll(async ({ request }) => {
  await expectSeedApiPreflight(request);
});

for (const route of routes) {
  test(`${route.name} supports product keyboard focus`, async ({
    page,
  }, testInfo) => {
    const issues: BrowserIssue[] = [];
    const canceledNavigations: string[] = [];
    const abortedApiRequests: string[] = [];
    const successfulRequestUrls = new Set<string>();

    page.on("pageerror", (error) => {
      issues.push({ kind: "pageerror", detail: error.message });
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        const locationUrl = message.location().url;
        const isKnownFavicon404 =
          message.type() === "error" &&
          message.text().includes("Failed to load resource") &&
          message.text().includes("404") &&
          locationUrl.length > 0 &&
          new URL(locationUrl).pathname === "/favicon.ico";
        if (isKnownFavicon404) return;
        issues.push({
          kind: `console-${message.type()}`,
          detail: `${message.text()} @ ${locationUrl}`,
        });
      }
    });
    page.on("response", (response) => {
      if (response.status() < 400) {
        successfulRequestUrls.add(response.url());
        return;
      }
      const url = new URL(response.url());
      if (response.status() === 404 && url.pathname === "/favicon.ico") return;
      issues.push({
        kind: "http",
        detail: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    });
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "unknown";
      if (
        request.isNavigationRequest() &&
        errorText.includes("net::ERR_ABORTED")
      ) {
        canceledNavigations.push(`${requestLabel(request)} :: ${errorText}`);
        return;
      }
      const url = new URL(request.url());
      if (
        request.method() === "GET" &&
        errorText.includes("net::ERR_ABORTED") &&
        url.pathname.startsWith("/api/backend/")
      ) {
        abortedApiRequests.push(request.url());
        return;
      }
      issues.push({
        kind: "requestfailed",
        detail: `${requestLabel(request)} :: ${errorText}`,
      });
    });

    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response, `${route.path} did not return a document response.`).not.toBeNull();
    expect(response?.status(), `${route.path} document status`).toBe(200);
    expect(new URL(page.url()).pathname).toBe(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();

    const layout = await readLayoutIssues(page);
    expect(layout.horizontalOverflow, `${route.path} horizontal overflow`).toBe(0);
    expect(layout.textClipping, `${route.path} text clipping`).toEqual([]);
    expect(layout.overlayDetails, `${route.path} Next.js error overlay`).toEqual([]);

    const candidateCount = await visibleEnabledFocusableCount(page);
    const firstFocusStep = await expectInitialTabDeterminism(
      page,
      candidateCount + 5,
    );
    const focusSteps = await collectKeyboardFocusSteps(page, firstFocusStep);

    const unresolvedAbortedApiRequests = abortedApiRequests.filter(
      (url) => !successfulRequestUrls.has(url),
    );
    for (const url of unresolvedAbortedApiRequests) {
      issues.push({
        kind: "requestfailed",
        detail: `GET ${url} :: net::ERR_ABORTED without a successful replacement`,
      });
    }

    expect(
      issues,
      `${route.path} (${testInfo.project.name}) browser issues`,
    ).toEqual([]);

    console.log(JSON.stringify({
      route: route.path,
      viewport: page.viewportSize(),
      project: testInfo.project.name,
      focusStepCount: focusSteps.length,
      focusSteps,
      canceledNavigations,
      replacedAbortedApiRequests: abortedApiRequests.filter(
        (url) => successfulRequestUrls.has(url),
      ),
      layout,
    }));
  });
}
