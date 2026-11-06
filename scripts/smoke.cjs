/**
 * Smoke test of the production build (run `npm run build` first).
 *   npm run smoke
 * Serves dist/ with `vite preview`, then drives Chromium via Playwright:
 *  1. online: Explore renders a verdict, Detective Scan opens, no page errors
 *  2. OFFLINE (every non-localhost request aborted): all Case Files still
 *     render their numbers from bundled data.
 * Uses the globally installed Playwright (require('playwright')).
 */
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not start')), 20000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
  });
}

const failures = [];
const check = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.log(`  ✗ ${msg}`);
    failures.push(msg);
  }
};

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    // ---------------------------------------------------------------- online
    console.log('online');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}#explore?lat=42.87&lon=74.59&v=T2M`);
    await page.waitForSelector('[data-tour="verdict"]', { timeout: 20000 });
    const verdict = await page.locator('[data-tour="verdict"]').innerText();
    check(/per decade/.test(verdict) && /SIGNIFICANT/i.test(verdict), 'Explore shows a verdict for Bishkek T2M');
    await page.getByRole('button', { name: 'Run Detective Scan' }).click();
    await page.waitForSelector('text=/significant · .* suggestive/', { timeout: 20000 });
    check(true, 'Detective Scan finishes in the web worker');
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}#explore?lat=42.87&lon=74.59&site=hospital`);
    await page.waitForSelector('[data-tour="site-panel"]', { timeout: 20000 });
    await page.getByRole('button', { name: /20 × 20 km square/ }).click();
    await page.waitForSelector('text=/\\(\\d+ \\/ 100\\)/', { timeout: 20000 });
    check(true, 'Site check scores a 20 × 20 km square around Bishkek');
    for (const mode of ['cases', 'compare', 'learn']) {
      await page.goto(`${BASE}#${mode}`);
      await page.waitForTimeout(1500);
      check((await page.locator('main h1').count()) > 0, `#${mode} renders`);
    }
    check(errors.length === 0, `no page errors online${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await page.close();

    // ---------------------------------------------------------------- offline
    console.log('offline (all external hosts blocked)');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.route('**/*', (route) => (new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort()));
    const off = await ctx.newPage();
    const offErrors = [];
    off.on('pageerror', (e) => offErrors.push(e.message));
    const cases = { snow: 5, arctic: 5, aral: 5, bishkek: 3, almost: 3 };
    for (const [id, n] of Object.entries(cases)) {
      for (let s = 0; s < n; s++) {
        await off.goto(`${BASE}#cases?id=${id}&step=${s}`);
        await off.waitForTimeout(s === 0 ? 2500 : 1200);
        const text = await off.locator('aside').innerText().catch(() => '');
        // facts that failed to load render as "…" (see features/case-files/facts.ts)
        const unresolved = /… per decade|p = …/.test(text);
        check(text.length > 50 && !unresolved, `case ${id} step ${s + 1}/${n} renders from bundled data`);
      }
    }
    let tiles = 0;
    off.on('response', (r) => r.url().includes('/data/demo/tiles/') && r.ok() && tiles++);
    await off.goto(`${BASE}#explore?lat=78.22&lon=15.65`);
    await off.waitForTimeout(5000);
    check(tiles > 0, `globe falls back to bundled Blue Marble tiles offline (${tiles} tiles)`);
    await off.goto(`${BASE}#cases?id=aral&step=0`);
    await off.waitForTimeout(2500);
    const imgs = await off.$$eval('[data-tour="time-machine"] img', (els) => els.map((e) => e.naturalWidth));
    check(imgs.length === 2 && imgs.every((w) => w > 0), 'Time Machine images load offline');
    check(offErrors.length === 0, `no page errors offline${offErrors.length ? ': ' + offErrors.join(' | ') : ''}`);
    await ctx.close();
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid, 'SIGTERM'); // kill the whole process group (npx + vite)
    } catch {
      server.kill();
    }
  }
  console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall smoke checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
