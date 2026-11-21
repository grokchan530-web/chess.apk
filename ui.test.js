// Run: node tests/ui.test.js  (needs playwright + chromium)
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || '/tmp/shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/chess.html'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/01-home.png' });

  // vs computer -> start
  await page.getByText('Play vs Computer').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/02-newgame.png' });
  await page.getByText('Start', { exact: true }).click();
  await page.waitForTimeout(400);

  const sqPos = async sq => page.evaluate(s => { const [x, y] = (function () { const r = R.cv.getBoundingClientRect(); const px = R.bx + (s & 7) * R.cs + R.cs / 2, py = R.by + (7 - (s >> 4)) * R.cs + R.cs / 2; return [r.left + px * r.width / R.side, r.top + py * r.height / R.side]; })(); return { x, y }; }, sq);
  
  const sq = n => page.evaluate(n => Chess.nameSq(n), n);
  async function tap(name) { const s = await sq(name); const p = await sqPos(s); await page.mouse.click(p.x, p.y); }
  async function play(from, to) { await tap(from); await page.waitForTimeout(80); await tap(to); }

  await play('e2', 'e4');
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/03-mid-anim.png' });
  await page.waitForFunction(() => G.moves.length >= 2 && !G.thinking, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const m1 = await page.evaluate(() => G.sans.join(' '));
  console.log('after e4, AI replied:', m1);
  await tap('g1'); await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + '/04-selected.png' });
  await tap('f3');
  await page.waitForFunction(() => G.moves.length >= 4 && !G.thinking, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '/05-game.png' });
  console.log('moves:', await page.evaluate(() => G.sans.join(' ')));

  // illegal move must not change state
  const before = await page.evaluate(() => G.moves.length);
  await play('a1', 'a5');
  await page.waitForTimeout(200);
  console.log('illegal move ignored:', before === await page.evaluate(() => G.moves.length));

  // undo takes back player + AI move
  await page.evaluate(() => undo());
  await page.waitForTimeout(300);
  console.log('after undo moves:', await page.evaluate(() => G.moves.length), 'redo available:', await page.evaluate(() => G.redo.length));

  // settings sheet
  await page.locator('#a-gear').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/06-settings-game.png' });
  for (const t of ['Board', 'Pieces', 'Effects', 'Display']) {
    await page.locator('.tab', { hasText: t }).click(); await page.waitForTimeout(150);
    await page.screenshot({ path: OUT + '/07-settings-' + t.toLowerCase() + '.png' });
  }
  // change settings live: neon board + show grid, dashed
  await page.locator('.tab', { hasText: 'Board' }).click();
  await page.getByRole('button', { name: 'Neon', exact: true }).click();
  await page.waitForTimeout(200);
  await page.locator('.row', { hasText: 'Show grid lines' }).locator('.switch').click();
  await page.waitForTimeout(200);
  console.log('boardTheme', await page.evaluate(() => S.boardTheme + ' showGrid=' + S.showGrid + ' light=' + S.lightColor));
  await page.locator('button', { hasText: 'Done' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/08-neon-grid.png' });

  // landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/09-landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
