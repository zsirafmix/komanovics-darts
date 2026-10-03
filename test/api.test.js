// Integrációs teszt: az Express app memóriabeli tárolóval, véletlen porton.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

let server;
let base;
before(async () => {
  const app = createApp({ store: createMemoryStore({ table: 'darts_scores' }), rateLimitPerMin: 3 });
  await new Promise((r) => (server = app.listen(0, '127.0.0.1', r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (body) =>
  fetch(`${base}/api/scores`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /healthz', async () => {
  const j = await (await fetch(`${base}/healthz`)).json();
  assert.equal(j.ok, true);
  assert.equal(j.storage, 'memory');
  assert.equal(j.table, 'darts_scores');
});

test('GET / kiszolgálja a játékot', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /KOMÁNOVICS Darts/);
});

test('POST + GET /api/scores, rendezés, rate limit', async () => {
  let r = await post({ name: 'Teszt', score: 250, level: 8, durationSec: 80 });
  assert.equal(r.status, 201);
  r = await post({ name: 'Béla', score: 400, level: 8, durationSec: 95 });
  assert.equal((await r.json()).rank, 1);
  r = await post({ name: 'Csaló', score: 4000, level: 8, durationSec: 5 });
  assert.equal(r.status, 400);
  r = await post({ name: 'X', score: 1, durationSec: 30 });
  assert.equal(r.status, 429);
  const g = await (await fetch(`${base}/api/scores`)).json();
  assert.deepEqual(g.scores.map((s) => s.score), [400, 250]);
});
