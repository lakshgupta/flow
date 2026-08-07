import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for the app to load
    await page.route('**/api/workspace', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scope: 'local',
          workspacePath: '/tmp/flow-workspace',
          flowPath: '/tmp/flow-workspace/.flow',
          configPath: '/tmp/flow-workspace/.flow/config/config.toml',
          indexPath: '/tmp/flow-workspace/.flow/config/flow.index',
          homePath: 'data/home.md',
          guiPort: 4812,
          panelWidths: { leftRatio: 0.31, rightRatio: 0.22 }
        })
      });
    });

    await page.route('**/api/graphs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          home: {
            id: 'home',
            type: 'home',
            title: 'Home',
            description: '',
            path: 'data/home.md',
            body: '# Home\n'
          },
          graphs: []
        })
      });
    });

    await page.route('**/api/graphs/note', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'note',
          availableGraphs: [],
          graphItems: {}
        })
      });
    });

    await page.route('**/api/graphs/task', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'task',
          availableGraphs: [],
          graphItems: {}
        })
      });
    });

    await page.route('**/api/graphs/command', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'command',
          availableGraphs: [],
          graphItems: {}
        })
      });
    });
  });

  test('light theme desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force light theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.remove('dark');
      root.dataset.theme = 'light';
      root.style.setProperty('color-scheme', 'light');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('light-theme-desktop.png');
  });

  test('dark theme desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force dark theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      root.style.setProperty('color-scheme', 'dark');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('dark-theme-desktop.png');
  });

  test('light theme tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force light theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.remove('dark');
      root.dataset.theme = 'light';
      root.style.setProperty('color-scheme', 'light');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('light-theme-tablet.png');
  });

  test('dark theme tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force dark theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      root.style.setProperty('color-scheme', 'dark');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('dark-theme-tablet.png');
  });

  test('light theme mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force light theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.remove('dark');
      root.dataset.theme = 'light';
      root.style.setProperty('color-scheme', 'light');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('light-theme-mobile.png');
  });

  test('dark theme mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('text=FRESH WORKSPACE');

    // Force dark theme (matches ThemeProvider's applyTheme: root class + dataset)
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      root.style.setProperty('color-scheme', 'dark');
    });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('dark-theme-mobile.png');
  });
});