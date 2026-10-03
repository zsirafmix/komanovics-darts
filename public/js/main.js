// Belépési pont: vászon méretezése, fő ciklus, képernyők (menü / szünet / kör vége / záróra), HUD, ranglista.
import { W, ROUNDS, DARTS_PER_ROUND, DRINKS } from './config.js';
import { Game } from './game.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { fetchScores, submitScore } from './api.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const app = $('#app');
const fmt = (n, d = 1) => n.toLocaleString('hu-HU', { minimumFractionDigits: d, maximumFractionDigits: 2 });

const head = new Image();
head.src = 'assets/eduard-head.png';

const sound = new Sound();
let game;
const input = new Input(canvas, {
  onPress: (key) => {
    sound.ensure();
    if (!game) return false;
    return game.press(key);
  },
  onRelease: (cancel) => game?.release(cancel),
  onPause: () => togglePause(),
});

let bannerTimer = 0;
function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1900);
}

game = new Game({ sound, input, head, ui: { banner, onRoundEnd, onGameOver } });
// Teszt/hibakereső hozzáférés (a smoke teszt használja). Nem tartalmaz titkot.
window.__KD = { game, sound, input };

// ------------------------------------------------------------------ méretezés
let pixelScale = 1;
function resize() {
  const cssW = app.clientWidth;
  const cssH = app.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  pixelScale = canvas.width / W;
  game.resize((cssH / cssW) * W, pixelScale);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ------------------------------------------------------------------ fő ciklus
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // tab-váltás után ne ugorjon nagyot
  last = now;
  game.update(dt);
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  game.draw(ctx);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ HUD
const dartSvg = (full) =>
  `<svg viewBox="0 0 12 26" class="${full ? 'dart-full' : 'dart-empty'}"><path d="M6 1 L7 9 L10.5 13 L7.5 13 L7.5 17 L10 25 L6 21 L2 25 L4.5 17 L4.5 13 L1.5 13 L5 9 Z"/></svg>`;
const DRUNK_WORDS = [
  [0, 'józan'],
  [15, 'spicces'],
  [35, 'kapatos'],
  [55, 'részeg'],
  [75, 'tök részeg'],
  [92, 'szétcsúszott'],
];
const hud = {};
function resetHud() {
  for (const k of ['score', 'mult', 'round', 'darts', 'drunk']) hud[k] = null;
}
function updateHud() {
  if (game.state === 'menu') return;
  if (game.total !== hud.score) $('#hud-score').textContent = (hud.score = game.total).toLocaleString('hu-HU');
  const m = '×' + fmt(game.mult);
  if (m !== hud.mult) $('#hud-mult').textContent = hud.mult = m;
  const r = `${Math.min(game.round, ROUNDS)}/${ROUNDS}`;
  if (r !== hud.round) $('#hud-round').textContent = hud.round = r;
  const left = game.state === 'roundEnd' || game.state === 'drinking' ? DARTS_PER_ROUND : game.dartsLeft;
  if (left !== hud.darts) {
    hud.darts = left;
    $('#hud-darts').innerHTML = Array.from({ length: DARTS_PER_ROUND }, (_, i) => dartSvg(i < left)).join('');
  }
  const d = Math.round(game.drunk);
  if (d !== hud.drunk) {
    hud.drunk = d;
    const f = $('#hud-drunk');
    f.style.width = d + '%';
    f.classList.toggle('max', d >= 90);
    $('#hud-drunk-txt').textContent = DRUNK_WORDS.filter(([min]) => d >= min).pop()[1];
  }
}

// ------------------------------------------------------------------ képernyők
function show(id) {
  for (const s of $$('.screen')) s.hidden = s.id !== id;
}
function startGame() {
  sound.ensure();
  game.start();
  resetHud();
  show(null);
  $('#hud').hidden = false;
  sound.startMusic();
  const h = $('#aim-hint');
  h.hidden = false;
  h.style.animation = 'none';
  void h.offsetWidth; // animáció újraindítása
  h.style.animation = '';
}
function togglePause(force) {
  if (game.state === 'menu' || game.state === 'over' || game.state === 'roundEnd') return;
  game.paused = force !== undefined ? force : !game.paused;
  if (game.paused) game.release(true);
  show(game.paused ? 'screen-pause' : null);
  sound.duckMusic(game.paused);
}
function toMenu() {
  game.reset();
  sound.stopMusic();
  $('#hud').hidden = true;
  $('#aim-hint').hidden = true;
  show('screen-start');
  refreshBest();
  loadBoard('#lb-start');
}

$('#btn-start').addEventListener('click', startGame);
$('#btn-again').addEventListener('click', startGame);
$('#btn-menu').addEventListener('click', toMenu);
$('#btn-resume').addEventListener('click', () => togglePause(false));
$('#btn-quit').addEventListener('click', toMenu);
$('#btn-pause').addEventListener('click', () => togglePause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) togglePause(true);
});

// némítás (localStorage-ben megjegyezve)
function syncMute() {
  document.body.classList.toggle('muted', sound.muted);
  for (const b of $$('.js-mute-label')) {
    b.textContent = sound.muted ? 'Hang: KI' : 'Hang: BE';
    b.classList.toggle('on', !sound.muted);
  }
}
function toggleMute() {
  sound.ensure();
  sound.setMuted(!sound.muted);
  syncMute();
}
for (const b of $$('.js-mute')) b.addEventListener('click', toggleMute);
window.addEventListener('keydown', (e) => {
  if (document.activeElement?.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'm' && !e.repeat) toggleMute();
  if (e.key === 'Enter' && !$('#screen-start').hidden) startGame();
  if (!$('#screen-round').hidden && ['1', '2', '3', '4'].includes(e.key)) {
    pickDrink(['froccs', 'sor', 'palinka', 'kave'][Number(e.key) - 1]);
  }
});
syncMute();

// ------------------------------------------------------------------ kör vége / ital
function onRoundEnd(s) {
  setTimeout(() => {
    $('#round-title').textContent = `${s.round}. kör vége`;
    const ul = $('#round-darts');
    ul.textContent = '';
    for (const [i, text] of s.darts.entries()) {
      const li = document.createElement('li');
      li.textContent = text;
      const dart = game.roundDarts[i];
      if (dart && dart.points >= 40) li.classList.add('hit');
      if (dart && (dart.points === 0 || dart.bonus < 0)) li.classList.add('bad');
      ul.append(li);
    }
    const bonus = s.bonus ? ` ${s.bonus > 0 ? '+' : '−'} ${Math.abs(s.bonus)} bónusz` : '';
    $('#round-calc').innerHTML = '';
    const calc = $('#round-calc');
    calc.append(`${s.base} × ${fmt(s.mult)}${bonus} = `);
    const b = document.createElement('b');
    b.textContent = `${s.roundScore > 0 ? '+' : ''}${s.roundScore}`;
    calc.append(b, ` pont  ·  összesen: ${s.total}`);
    $('.drink.coffee').disabled = s.coffeeUsed;
    show('screen-round');
  }, 350);
}
function pickDrink(kind) {
  if (game.chooseDrink(kind)) show(null);
}
for (const b of $$('.drink')) {
  // a gombok feliratai mindig a config.js értékeiből jönnek (ne csússzon szét a HTML-lel)
  const D = DRINKS[b.dataset.drink];
  b.querySelector('.d-mult').textContent = '×' + fmt(D.mult);
  b.querySelector('.d-desc').textContent = (D.drunk > 0 ? '+' : '−') + Math.abs(D.drunk) + (b.dataset.drink === 'kave' ? ', csak 1×' : ' részegség');
  b.addEventListener('click', () => pickDrink(b.dataset.drink));
}

// ------------------------------------------------------------------ ranglista
function renderBoard(sel, scores, highlight) {
  const ol = $(sel);
  ol.textContent = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Még senki nem dobott. Légy te az első!';
    ol.append(li);
    return;
  }
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = s.name; // textContent: a név sosem értelmeződik HTML-ként
    const v = document.createElement('span');
    v.className = 's';
    v.textContent = s.score.toLocaleString('hu-HU');
    li.append(n, v);
    if (highlight && highlight.rank === i + 1 && highlight.name === s.name) li.classList.add('me');
    ol.append(li);
  });
}
async function loadBoard(sel) {
  try {
    const { scores } = await fetchScores();
    renderBoard(sel, scores);
  } catch (err) {
    $(sel).textContent = '';
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = err.message || 'A ranglista nem érhető el.';
    $(sel).append(li);
  }
}
function refreshBest() {
  const b = Number(localStorage.getItem('kd_best') || 0);
  $('#best').textContent = b ? `Saját rekordod: ${b.toLocaleString('hu-HU')} pont` : '';
}

let lastResult = null;
function onGameOver(r) {
  lastResult = r;
  const best = Number(localStorage.getItem('kd_best') || 0);
  const isBest = r.score > best;
  if (isBest) localStorage.setItem('kd_best', String(r.score));
  setTimeout(() => {
    $('#hud').hidden = true;
    $('#aim-hint').hidden = true;
    $('#over-score').textContent = r.score.toLocaleString('hu-HU');
    $('#over-rank').textContent = `Rang: ${r.rank}`;
    const st = r.stats || {};
    $('#over-stats').textContent =
      `${st.triples || 0} tripla · ${st.doubles || 0} dupla · ${st.bulls || 0} bika · legjobb kör: ${st.best || 0} · ${st.events || 0} kocsmai baleset` +
      (isBest ? ' · ÚJ SAJÁT REKORD!' : '');
    $('#name').value = localStorage.getItem('kd_name') || '';
    $('#btn-submit').disabled = false;
    $('#form-score').hidden = r.score <= 0;
    const msg = $('#submit-msg');
    msg.textContent = '';
    msg.className = 'msg';
    show('screen-over');
    loadBoard('#lb-over');
  }, 1200);
}

$('#form-score').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!lastResult) return;
  const name = $('#name').value.trim();
  const msg = $('#submit-msg');
  if (!name) {
    msg.textContent = 'Add meg a neved!';
    msg.className = 'msg err';
    return;
  }
  $('#btn-submit').disabled = true;
  msg.textContent = 'Küldés…';
  msg.className = 'msg';
  try {
    const res = await submitScore({ name, score: lastResult.score, level: lastResult.level, durationSec: lastResult.durationSec });
    localStorage.setItem('kd_name', res.name);
    msg.textContent = `Elmentve! Helyezésed: ${res.rank}.`;
    msg.className = 'msg ok';
    $('#form-score').hidden = true;
    renderBoard('#lb-over', res.scores, res);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg err';
    $('#btn-submit').disabled = false;
  }
});

refreshBest();
loadBoard('#lb-start');
