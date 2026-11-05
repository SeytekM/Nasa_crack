// Dev helper: screenshot a URL with Playwright (pre-installed globally).
// Usage: node scripts/shot.cjs <url> <out.png> [width] [height] [theme] [waitMs]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = '1440', h = '900', theme = 'dark', wait = '6000'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.addInitScript((t) => localStorage.setItem('etd-theme', t), theme);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(Number(wait));
  await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
