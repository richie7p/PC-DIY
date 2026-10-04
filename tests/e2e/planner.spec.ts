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

test("copied builds, share links and pinned comparisons follow the current configuration", async ({ page, context }, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/"); await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page.getByRole("button", { name: "自動組", exact: true }).click();
  await page.locator("#auto-fill").getByRole("button", { name: "遊戲", exact: true }).click();
  await page.getByRole("button", { name: "複製分享連結", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.getByRole("button", { name: "複製", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("CPU"); expect(copied).not.toContain("undefined");
  await page.getByRole("button", { name: "釘選對照", exact: true }).click();
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(page.getByText("對照釘選組", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消對照", exact: true }).click();
  await expect(page.getByText("對照釘選組", { exact: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath("copy-and-comparison.png"), fullPage: true });
});

test("clipboard rejection reports failure instead of claiming success", async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    document.execCommand = () => false;
  });
  await page.goto("/"); await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  for (const name of ["複製", "複製分享連結"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("瀏覽器未允許複製");
    await expect(page.getByRole("button", { name: "已複製", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "已複製連結", exact: true })).toHaveCount(0);
    expect(await page.locator('textarea[readonly]').count()).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("clipboard-failure.png") });
});
