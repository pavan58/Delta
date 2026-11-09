import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DB = process.env.TEST_DATABASE_URL ?? "postgresql://azuregigs:azuregigs@localhost:5432/azuregigs_test?schema=public";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure", viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DATABASE_URL: DB, E2E: "1", APP_URL: `http://localhost:${PORT}` },
  },
});
