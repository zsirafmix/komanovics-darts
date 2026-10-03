// Egyensúly-szimulátor (fejlesztői eszköz, nem része a CI-nek).
// Headless Chrome-ban sok teljes játékot lejátszik "emberi" célzási hibával (sd 4 és 12 logikai px),
// négy ital-stratégiával (mindig fröccs / sör / pálinka / vegyes+kávé), és kiírja a pontszám mediánt/átlagot/maximumot.
// Az italok paraméterei felülírhatók: P='{"sor":{"drunk":12,"mult":1.35}}' node tools/balance.mjs
// Futtatás: npm run balance   (BASE_URL=... ha már fut egy szerver; különben elindít egyet memóriatárolóval)
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

let server;
let base = process.env.BASE_URL;
if (!base) {
  const port = 3800 + Math.floor(Math.random() * 90);
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATABASE_URL: '' }, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + '/healthz')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle0' });
const params = JSON.parse(process.env.P || '{}');
const res = await page.evaluate(async (params) => {
  const C = await import('/js/config.js');
  for (const [k, v] of Object.entries(params)) Object.assign(C.DRINKS[k], v);
  const { game: g, input } = window.__KD;
  let over = null;
  g.ui = { banner() {}, onRoundEnd() {}, onGameOver: (r) => (over = r) };
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
  const out = {};
  for (const aimSd of [4, 12]) for (const strat of ['froccs', 'sor', 'palinka', 'mix']) {
    const scores = [];
    for (let n = 0; n < 60; n++) {
      g.start(); over = null; let f = 0;
      let relAt = 0;
      while (!over && f < 36000) {
        f++;
        if (g.state === 'aim' && !g.charging) {
          input.target = { x: g.L.cx + gauss() * aimSd, y: g.L.cy - 101 * g.L.s + gauss() * aimSd };
          input.hasTarget = true; g.press(); relAt = Math.min(0.97, 0.6 + Math.random() * 0.3 + gauss() * aimSd * 0.004);
          g.aimWait = 0.4 + Math.random() * 0.6;
        }
        g.update(1 / 60);
        if (g.charging) { g.aimWait -= 1/60; if (g.aimWait < 0 && g.power > relAt) g.release(false); }
        if (g.state === 'roundEnd') {
          let d = strat;
          if (strat === 'mix') d = g.drunk > 55 && !g.coffeeUsed ? 'kave' : g.drunk > 40 ? 'froccs' : 'sor';
          g.chooseDrink(d);
        }
      }
      scores.push(over.score);
    }
    scores.sort((a, b) => a - b);
    out[`sd${aimSd}-${strat}`] = { med: scores[30], avg: Math.round(scores.reduce((a, b) => a + b) / scores.length), max: scores[59] };
  }
  return out;
}, params);
console.log(JSON.stringify(params)); for (const [k,v] of Object.entries(res)) console.log(k, JSON.stringify(v));
await browser.close();
server?.kill();
