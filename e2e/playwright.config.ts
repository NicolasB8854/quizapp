/**
 * E2E-Klicktest: echter Browser (installiertes Chrome), Frontend-Build per
 * `vite preview` und lokaler WS-Server mit denselben Handlern wie die Lambda.
 *
 *   npm run e2e            # baut alles und spielt die Runden durch
 * Screenshots: e2e/artifacts/ (gitignored)
 */
import { defineConfig, devices } from '@playwright/test'

const WS_PORT = 8787
const WEB_PORT = 4180

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'artifacts/results',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    ...devices['Pixel 7'],
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `node server/dist-local/server.cjs ${WS_PORT}`,
      cwd: '..',
      port: WS_PORT,
      reuseExistingServer: false,
    },
    {
      command: `npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: '..',
      port: WEB_PORT,
      reuseExistingServer: false,
    },
  ],
})
