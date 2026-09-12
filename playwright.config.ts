import { defineConfig } from "@playwright/test";

const port = process.env.PW_TEST_PORT ?? "4187";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "bun run dev",
    url: baseURL,
    env: { PORT: port },
    reuseExistingServer: false,
  },
});
