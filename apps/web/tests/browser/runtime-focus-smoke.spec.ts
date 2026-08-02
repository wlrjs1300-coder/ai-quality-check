import { expect, test, type Locator, type Page } from "@playwright/test";

type FocusMetrics = {
  tagName: string;
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  focusLeft: number;
  focusTop: number;
  focusRight: number;
  focusBottom: number;
  viewportWidth: number;
  viewportHeight: number;
};

type ConsoleError = {
  text: string;
  url: string;
};

async function readFocusMetrics(
  page: Page,
  locator: Locator,
): Promise<FocusMetrics> {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
    const focusExpansion = outlineWidth + outlineOffset;

    return {
      tagName: element.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth,
      outlineOffset,
      focusLeft: rect.left - focusExpansion,
      focusTop: rect.top - focusExpansion,
      focusRight: rect.right + focusExpansion,
      focusBottom: rect.bottom + focusExpansion,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

test("runtime validation route supports real keyboard focus traversal", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: ConsoleError[] = [];
  const resource404Urls: string[] = [];
  const requestFailures: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({
        text: message.text(),
        url: message.location().url,
      });
    }
  });

  page.on("response", (response) => {
    if (response.status() === 404) {
      resource404Urls.push(response.url());
    }
  });

  page.on("requestfailed", (request) => {
    requestFailures.push(
      `${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });

  const response = await page.goto("/runtime-validation");

  expect(response).not.toBeNull();
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Phase A3 Runtime 상태 검증",
    }),
  ).toBeVisible();

  const retryButtons = page.getByRole("button", {
    name: "다시 시도",
  });

  await expect(retryButtons).toHaveCount(2);

  const initialActiveElement = await page.evaluate(
    () => document.activeElement?.tagName ?? null,
  );

  expect(initialActiveElement).toBe("BODY");

  const firstRetryButton = retryButtons.nth(0);
  const secondRetryButton = retryButtons.nth(1);

  await page.keyboard.press("Tab");
  await expect(firstRetryButton).toBeFocused();

  const firstFocusMetrics = await readFocusMetrics(
    page,
    firstRetryButton,
  );

  expect(firstFocusMetrics.tagName).toBe("BUTTON");
  expect(firstFocusMetrics.outlineStyle).not.toBe("none");
  expect(firstFocusMetrics.outlineWidth).toBeGreaterThan(0);
  expect(firstFocusMetrics.focusLeft).toBeGreaterThanOrEqual(0);
  expect(firstFocusMetrics.focusTop).toBeGreaterThanOrEqual(0);
  expect(firstFocusMetrics.focusRight).toBeLessThanOrEqual(
    firstFocusMetrics.viewportWidth,
  );
  expect(firstFocusMetrics.focusBottom).toBeLessThanOrEqual(
    firstFocusMetrics.viewportHeight,
  );

  await page.keyboard.press("Tab");
  await expect(secondRetryButton).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(firstRetryButton).toBeFocused();

  const unexpected404Urls = resource404Urls.filter(
    (url) => !new URL(url).pathname.endsWith("/favicon.ico"),
  );

  const unexpectedConsoleErrors = consoleErrors.filter(({ text, url }) => {
    const isResource404 =
      text.includes("Failed to load resource") &&
      text.includes("404");

    const isKnownFavicon =
      url.length > 0 &&
      new URL(url).pathname.endsWith("/favicon.ico");

    return !(isResource404 && isKnownFavicon);
  });

  expect(pageErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
  expect(unexpected404Urls).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});