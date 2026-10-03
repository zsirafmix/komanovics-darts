// A kliensoldali darts-pontozás (public/js/board.js) és az italok konfigurációjának tesztjei.
// A modulok tiszta ES modulok, a DOM-ot csak rajzoláskor használják, így Node-ban is importálhatók.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAt, RING, ORDER } from '../public/js/board.js';
import { DRINKS, ROUNDS, DARTS_PER_ROUND } from '../public/js/config.js';
import { GAME } from '../server/gameConfig.js';

const s = 1; // 1 px / mm
const polar = (num, rMm) => {
  // a szám szektorának közepe: 0° = fent, óramutató szerint
  const a = ((ORDER.indexOf(num) * 18) * Math.PI) / 180;
  return [Math.sin(a) * rMm, -Math.cos(a) * rMm];
};

test('bika: 50 és 25', () => {
  assert.equal(scoreAt(0, 0, s).points, 50);
  assert.equal(scoreAt(RING.bull50 + 1, 0, s).points, 25);
});

test('szimpla / dupla / tripla minden szektorban', () => {
  for (const num of ORDER) {
    const single = scoreAt(...polar(num, 60), s);
    assert.deepEqual([single.points, single.ring, single.num], [num, 'single', num]);
    const triple = scoreAt(...polar(num, (RING.tripleIn + RING.tripleOut) / 2), s);
    assert.deepEqual([triple.points, triple.ring], [num * 3, 'triple']);
    const dbl = scoreAt(...polar(num, (RING.doubleIn + RING.doubleOut) / 2), s);
    assert.deepEqual([dbl.points, dbl.ring], [num * 2, 'double']);
  }
});

test('tábla széle 0 pont, azon kívül null; skálázás', () => {
  const edge = scoreAt(0, -(RING.doubleOut + 10), s);
  assert.deepEqual([edge.points, edge.ring], [0, 'surround']);
  assert.equal(scoreAt(0, -(RING.surround + 1), s), null);
  assert.equal(scoreAt(0, -101 * 0.7, 0.7).points, 60); // T20 kisebb skálán
});

test('italok: erősebb ital = több részegség és nagyobb szorzó; kávé józanít', () => {
  assert.ok(DRINKS.froccs.drunk < DRINKS.sor.drunk && DRINKS.sor.drunk < DRINKS.palinka.drunk);
  assert.ok(DRINKS.froccs.mult < DRINKS.sor.mult && DRINKS.sor.mult < DRINKS.palinka.mult);
  assert.ok(DRINKS.kave.drunk < 0);
});

test('a szerver határai lefedik az elméleti maximumot', () => {
  const maxMult = Math.max(...Object.values(DRINKS).map((d) => d.mult));
  const theoretical = ROUNDS * DARTS_PER_ROUND * 60 * maxMult + ROUNDS * DARTS_PER_ROUND * 10; // minden nyíl T20 (+ agancs-bónusz felső becslés)
  assert.ok(GAME.limits.scoreMax >= theoretical, `scoreMax ${GAME.limits.scoreMax} < ${theoretical}`);
  assert.equal(GAME.limits.levelMax, ROUNDS);
});
