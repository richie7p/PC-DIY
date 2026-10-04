import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT ?? 6362);
const dev = process.env.E2E_DEV === "1";
export default defineConfig({
  testDir: "./tests/e2e", timeout: 60_000, expect: { timeout: 15_000 }, workers: 1,
  forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: { command: `npm run ${dev ? "dev" : "preview"} -- --host 127.0.0.1 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 180_000 },
});
