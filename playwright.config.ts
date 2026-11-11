import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '*.spec.ts', workers: 1, use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5178', browserName: 'chromium', channel: 'msedge', headless: true }, reporter: 'list', webServer: { command: 'npm run preview', url: 'http://127.0.0.1:5178', reuseExistingServer: true } });
