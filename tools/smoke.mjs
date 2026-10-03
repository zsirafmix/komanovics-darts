// Headless smoke teszt (puppeteer-core + helyi Chrome/Chromium).
// - Elindítja a szervert memóriabeli tárolóval egy szabad porton (vagy BASE_URL-t használ),
// - telefon-méretű nézetben végigjátszik egy teljes 8 körös játékot: valódi egérrel célzás + nyomva tartás + elengedés,
//   a többi dobás a window.__KD hookokon át (célpont + erő), italválasztás gombokkal, vicces események kikényszerítése,
//   záróra -> név beküldése,
// - gyorsított szimulációval sok teljes játékot lefuttat (futásidejű hibák + pontszám-eloszlás),
// - képernyőképeket ment a SCREENSHOT_DIR-be (alapértelmezés: ./screenshots),
// - hibával lép ki, ha konzolhiba / oldalhiba volt, vagy a ranglista beküldés nem sikerült.
// Futtatás: npm run smoke   (CHROME_PATH=/útvonal/chrome, ha nem /usr/bin/google-chrome)
//           BASE_URL=https://... SUBMIT=0 npm run smoke   (élő oldal ellenőrzése beküldés nélkül)
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = process.env.SCREENSHOT_DIR || 'screenshots';
const SUBMIT = process.env.SUBMIT !== '0';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let base = process.env.BASE_URL;
if (!base) {
  const port = 3900 + Math.floor(Math.random() * 90);
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATABASE_URL: '' }, stdio: 'inherit' });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + '/healthz')).ok) break;
    } catch {}
    await sleep(100);
  }
}

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

/** Egy dobás a hookokon át: célpont (logikai koordináta) + erő, majd megvárja a következő állapotot. */
async function throwAt(page, x, y, power = 0.72) {
  await page.waitForFunction(() => window.__KD.game.state === 'aim' && !window.__KD.game.paused, { timeout: 8000 });
  await page.evaluate(
    (x, y, power) => {
      const { game: g, input } = window.__KD;
      input.target = { x, y };
      input.hasTarget = true;
      g.aim = { x, y }; // a késleltetett követés átugrása
      g.cross = { x, y };
      g.press();
      g.power = power;
      g.release(false);
    },
    x,
    y,
    power,
  );
}
async function waitRoundEnd(page) {
  await page.waitForFunction(() => !document.querySelector('#screen-round').hidden || !document.querySelector('#screen-over').hidden, { timeout: 10000 });
}

try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, '01-start.png') });

  await page.click('#btn-start');
  await sleep(600);
  const L = await page.evaluate(() => {
    const g = window.__KD.game;
    const r = document.querySelector('#game').getBoundingClientRect();
    return { ...g.L, k: r.width / 400, left: r.left, top: r.top };
  });
  const toPx = (x, y) => ({ x: L.left + x * L.k, y: L.top + y * L.k });

  // 1. nyíl: valódi egér – mozgatás a bikára, nyomva tartás (erőgyűjtés), elengedés
  const bull = toPx(L.cx, L.cy);
  await page.mouse.move(bull.x, bull.y, { steps: 5 });
  await sleep(500);
  await page.mouse.down();
  await sleep(250);
  await page.screenshot({ path: path.join(OUT, '02-aim-power.png') });
  await sleep(120);
  await page.mouse.up();
  await sleep(60);
  await page.screenshot({ path: path.join(OUT, '03-flight.png') });
  await sleep(500);
  const first = await page.evaluate(() => window.__KD.game.roundDarts.map((d) => d.label));
  console.log('[smoke] first real-mouse dart:', first);
  if (first.length !== 1) errors.push('real mouse throw did not land a dart');

  // a kör többi nyila: tripla 20 és bika
  await throwAt(page, L.cx, L.cy - 101 * L.s);
  await sleep(450);
  await page.screenshot({ path: path.join(OUT, '04-result.png') });
  await throwAt(page, L.cx, L.cy);
  await waitRoundEnd(page);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '05-round-end.png') });

  // ital: sör (gombbal) -> ivás-animáció
  await page.click('.drink[data-drink="sor"]');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '06-drinking.png') });

  // 2. kör: vicces célpontok – cica, polc (üveg), csapos
  const cat = { x: L.cat.x + L.cat.w / 2, y: L.cat.y + L.cat.h / 2 };
  await throwAt(page, cat.x, cat.y, 0.75);
  await sleep(350);
  await page.screenshot({ path: path.join(OUT, '07-cat.png') });
  await throwAt(page, L.shelf.x + 10 + 17, L.shelf.y + 40, 0.75);
  await sleep(300);
  await throwAt(page, L.barman.x + L.barman.w / 2, L.barman.y + 15, 0.75);
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '08-barman.png') });
  await waitRoundEnd(page);
  const ev = await page.evaluate(() => window.__KD.game.history[1]);
  console.log('[smoke] round 2 (events):', JSON.stringify(ev));
  // kávé (egyszer), aztán már tiltva kell legyen
  await sleep(400);
  await page.click('.drink[data-drink="kave"]');

  // 3–8. kör: pálinka, részegen; közben agancs és óra
  for (let r = 3; r <= 8; r++) {
    const targets =
      r === 3
        ? [
            [L.trophy.x + L.trophy.w / 2, L.trophy.y + L.trophy.h / 2],
            [L.clock.x, L.clock.y],
            [L.cx, L.cy - 101 * L.s],
          ]
        : [
            [L.cx, L.cy - 101 * L.s],
            [L.cx, L.cy - 101 * L.s],
            [L.cx, L.cy],
          ];
    for (const [i, [x, y]] of targets.entries()) {
      if (r === 4 && i === 0) {
        // valódi érintés: az ujj a bika ALATT van, a célkereszt felette (TOUCH_OFFSET)
        await page.waitForFunction(() => window.__KD.game.state === 'aim', { timeout: 8000 });
        const p = toPx(L.cx, L.cy + 70);
        await page.touchscreen.touchStart(p.x, p.y);
        await sleep(380);
        await page.touchscreen.touchEnd();
        await page.waitForFunction(() => window.__KD.game.roundDarts.length === 1, { timeout: 3000 }).catch(() => errors.push('touch throw did not land a dart'));
        console.log('[smoke] touch dart:', await page.evaluate(() => window.__KD.game.roundDarts[0]?.label));
        continue;
      }
      await throwAt(page, x, y, 0.72);
      await sleep(80);
    }
    if (r === 7) {
      // részeg célzás képe: magas részegség, dupla látás, remegő célkereszt
      await page.waitForFunction(() => window.__KD.game.state === 'roundEnd' || window.__KD.game.state === 'aim', { timeout: 8000 });
    }
    await waitRoundEnd(page);
    if (r === 8) break;
    await sleep(400);
    const coffeeDisabled = await page.$eval('.drink.coffee', (b) => b.disabled);
    if (!coffeeDisabled) errors.push('coffee button should be disabled after use');
    await page.click('.drink[data-drink="palinka"]');
    if (r === 6) {
      await page.waitForFunction(() => window.__KD.game.state === 'aim', { timeout: 8000 });
      await page.evaluate(() => {
        window.__KD.game.drunk = 85;
        window.__KD.input.target = { x: window.__KD.game.L.cx, y: window.__KD.game.L.cy };
      });
      await sleep(900);
      await page.screenshot({ path: path.join(OUT, '09-drunk-aim.png') });
    }
  }
  await page.waitForFunction(() => !document.querySelector('#screen-over').hidden, { timeout: 8000 }).catch(() => errors.push('game over screen not visible'));
  const result = await page.evaluate(() => ({ total: window.__KD.game.total, history: window.__KD.game.history.map((h) => h.roundScore), drunk: window.__KD.game.drunk, time: window.__KD.game.time }));
  console.log('[smoke] full game:', JSON.stringify(result));
  if (SUBMIT) {
    await page.type('#name', 'Smoke Teszt');
    await page.click('#btn-submit');
    await page
      .waitForFunction(() => /Helyezésed/.test(document.querySelector('#submit-msg').textContent), { timeout: 5000 })
      .catch(async () => errors.push('score submit failed: ' + (await page.$eval('#submit-msg', (el) => el.textContent))));
  }
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '10-gameover.png') });
  console.log('[smoke] submit message:', await page.$eval('#submit-msg', (el) => el.textContent));

  // Gyorsított szimuláció: sok teljes játék, képkockánként update()+draw(); stratégiák:
  // 'random' (véletlen ital, tripla 20-ra céloz), 'sober' (mindig fröccs), 'palinka' (mindig pálinka).
  const sim = await page.evaluate(() => {
    const { game: g, input } = window.__KD;
    const ctx = document.querySelector('#game').getContext('2d');
    const origUi = g.ui;
    const out = {};
    let over = null;
    g.ui = { banner() {}, onRoundEnd() {}, onGameOver: (r) => (over = r) };
    for (const strat of ['sober', 'random', 'palinka']) {
      const scores = [];
      let maxRate = 0;
      let events = 0;
      for (let n = 0; n < 15; n++) {
        g.start();
        over = null;
        let frames = 0;
        while (!over && frames < 60 * 600) {
          frames++;
          if (g.state === 'aim' && !g.charging) {
            const aimBull = Math.random() < 0.3;
            input.target = { x: g.L.cx + (Math.random() - 0.5) * 8, y: g.L.cy - (aimBull ? 0 : 101 * g.L.s) };
            input.hasTarget = true;
            g.press();
          }
          g.update(1 / 60);
          if (g.state === 'aim' && g.charging && g.power > 0.6 + Math.random() * 0.3 && g.powerT > 0.2) g.release(false);
          if (g.state === 'roundEnd') {
            const d = strat === 'sober' ? 'froccs' : strat === 'palinka' ? 'palinka' : ['froccs', 'sor', 'palinka', 'kave'][Math.floor(Math.random() * 4)];
            if (!g.chooseDrink(d)) g.chooseDrink('sor');
          }
          if (frames % 6 === 0) g.draw(ctx);
        }
        if (!over) return { error: 'game did not finish', strat, state: g.state };
        scores.push(over.score);
        maxRate = Math.max(maxRate, over.score / Math.max(1, over.durationSec));
        events += g.stats.events;
      }
      scores.sort((a, b) => a - b);
      out[strat] = { min: scores[0], median: scores[scores.length >> 1], max: scores[scores.length - 1], maxPointsPerSec: Math.round(maxRate * 10) / 10, events };
    }
    g.ui = origUi;
    g.reset();
    return out;
  });
  console.log('[smoke] simulation', JSON.stringify(sim));
  if (sim.error) errors.push('simulation: ' + JSON.stringify(sim));
  else for (const s of Object.values(sim)) if (s.max > 5000 || s.maxPointsPerSec > 90) errors.push('simulated score exceeds server limits: ' + JSON.stringify(s));

  // asztali nézet
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.$eval('#btn-menu', (b) => b.click());
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '11-desktop-start.png') });
  await page.$eval('#btn-start', (b) => b.click());
  await sleep(500);
  const L2 = await page.evaluate(() => {
    const g = window.__KD.game;
    const r = document.querySelector('#game').getBoundingClientRect();
    return { cx: g.L.cx, cy: g.L.cy, k: r.width / 400, left: r.left, top: r.top };
  });
  await page.mouse.move(L2.left + L2.cx * L2.k + 30, L2.top + L2.cy * L2.k - 60, { steps: 8 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '12-desktop-aim.png') });
} finally {
  await browser.close();
  server?.kill();
}
if (errors.length) {
  console.error('[smoke] FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('[smoke] OK – screenshots in', OUT);
