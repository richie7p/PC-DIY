import { expect, test } from "@playwright/test";
test("autobuild, share-link persistence and low-budget protection", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/"); await expect(page.locator('[data-hydrated="true"]')).toBeVisible(); await page.getByRole("spinbutton", { name: "預算上限（美元）" }).fill("2000");
  await page.getByRole("button", { name: "自動組", exact: true }).click();
  await page.locator("#auto-fill").getByRole("button", { name: "遊戲", exact: true }).click();
  await expect(page).toHaveURL(/cpu=/); await expect(page).toHaveURL(/gpu=/);
  const original = new URL(page.url()).hash;
  await page.reload(); await expect(page.locator('[data-hydrated="true"]')).toBeVisible(); expect(new URL(page.url()).hash).toBe(original);
  await page.getByRole("spinbutton", { name: "預算上限（美元）" }).fill("100");
  await expect(page.getByText("不會自動套用，原配裝仍在。", { exact: false })).toBeVisible();
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("cpu")).toBe(new URLSearchParams(original.slice(1)).get("cpu"));
  await page.screenshot({ path: testInfo.outputPath("planner.png"), fullPage: true }); expect(errors).toEqual([]);
});
test("corrupt saved build recovers without invalid prices or crashes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rigforge-v2", JSON.stringify({ picks: "broken", budgetCap: -5, resolution: "8k" })));
  await page.goto("/"); await expect(page.locator('[data-hydrated="true"]')).toBeVisible(); await expect(page.getByRole("spinbutton", { name: "預算上限（美元）" })).toHaveValue("1500");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rigforge-v2")!).picks)).toEqual({});
  await expect(page.locator("body")).not.toContainText("NaN");
});
