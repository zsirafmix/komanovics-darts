import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, validateScore } from '../server/validate.js';
import { sslConfigFor, assertTableName, createStore } from '../server/store.js';
import { GAME } from '../server/gameConfig.js';

const L = GAME.limits;

test('sanitizeName: HTML és vezérlőkarakterek kiesnek, ékezet marad', () => {
  assert.equal(sanitizeName('<script>alert(1)</script>'), 'scriptalert1scri');
  assert.equal(sanitizeName('  Kománovics   Eduárd  '), 'Kománovics Eduár');
  assert.equal(sanitizeName(42), '');
});

test('validateScore (darts határok): érvényes', () => {
  const v = validateScore({ name: 'Teszt', score: 420, level: 8, durationSec: 90 }, L);
  assert.equal(v.ok, true);
  assert.deepEqual(v.value, { name: 'Teszt', score: 420, level: 8, durationSec: 90 });
});

test('validateScore (darts határok): elutasítások', () => {
  assert.equal(validateScore({ name: 'A', score: 10 }, L).ok, false, 'játékidő kötelező');
  assert.equal(validateScore({ name: 'A', score: 5001, durationSec: 999 }, L).ok, false, 'max pont');
  assert.equal(validateScore({ name: 'A', score: 10, level: 9, durationSec: 60 }, L).ok, false, 'max kör');
  assert.equal(validateScore({ name: 'A', score: 2000, durationSec: 10 }, L).ok, false, 'hihetetlen');
  assert.equal(validateScore({ name: '', score: 1, durationSec: 60 }, L).ok, false);
  assert.equal(validateScore({ name: 'A', score: 1.5, durationSec: 60 }, L).ok, false);
});

test('táblanév: csak biztonságos SQL-azonosító', () => {
  assert.equal(assertTableName('darts_scores'), 'darts_scores');
  assert.throws(() => assertTableName('scores; DROP TABLE x'));
  assert.throws(() => assertTableName('Scores'));
  assert.equal(createStore({}, { defaultTable: 'darts_scores' }).table, 'darts_scores');
  assert.equal(createStore({ SCORES_TABLE: 'proba_scores' }, { defaultTable: 'darts_scores' }).table, 'proba_scores');
  assert.equal(createStore({}, { defaultTable: 'darts_scores' }).kind, 'memory');
});

test('sslConfigFor: külső render host SSL, belső nem', () => {
  assert.deepEqual(sslConfigFor('postgresql://u:p@dpg-abc.frankfurt-postgres.render.com/db'), { rejectUnauthorized: false });
  assert.equal(sslConfigFor('postgresql://u:p@dpg-abc-a/db'), false);
});
