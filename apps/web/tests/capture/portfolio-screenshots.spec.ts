import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const seed = {
  projectId: "f555d12e-4708-506f-b9d9-0311105720c5",
  datasetId: "aedf9ea1-10e3-56d1-a45f-120e2550ec3b",
  experimentId: "4bc4a034-db3b-55f8-9153-46c201fa77c8",
  comparisonId: "3867438d-838a-5279-8956-c7b97ec55394",
} as const;

const outputDirectory = path.resolve(process.cwd(), "../..", "docs/portfolio/screenshots");

async function prepare(page: Page, route: string, heading: string) {
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByText(/불러오고 있습니다|Loading/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } nextjs-portal { display: none !important; }" });
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(outputDirectory, name), type: "png", fullPage: false, animations: "disabled" });
}

test("capture portfolio screenshots from the Demo Seed", async ({ page }) => {
  await prepare(page, `/projects/${seed.projectId}`, "EvalOps Demo Project");
  await expect(page.getByRole("heading", { level: 2, name: "Release Decision" })).toBeVisible();
  await capture(page, "project-overview.png");

  await prepare(page, `/projects/${seed.projectId}/experiments/${seed.experimentId}`, "Experiment 상세");
  await expect(page.getByRole("heading", { level: 2, name: "실행 결과" })).toBeVisible();
  await capture(page, "experiment-detail.png");

  await prepare(page, `/projects/${seed.projectId}/comparisons/${seed.comparisonId}`, "Comparison 상세");
  await expect(page.getByRole("heading", { level: 2, name: "Comparison 결과" })).toBeVisible();
  await capture(page, "comparison-detail.png");

  await prepare(page, `/projects/${seed.projectId}/history`, "History");
  await expect(page.locator(".history-result-card")).toHaveCount(4);
  await capture(page, "history.png");

  await prepare(page, `/projects/${seed.projectId}/datasets/${seed.datasetId}`, "Synthetic Release Policy Evaluation");
  await expect(page.getByRole("heading", { level: 2, name: "Dataset 요약" })).toBeVisible();
  await capture(page, "dataset-detail.png");
});
