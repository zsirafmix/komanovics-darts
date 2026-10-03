// A darts játék magja: állapotgép, remegő/késleltetett célzás, erőmérő, dobás és repülés,
// találat-feloldás (tábla + vicces kocsmai célpontok), körök, italválasztás, pontozás, rajzolás.
//
// Állapotok: 'menu' -> 'aim' -> 'flying' -> 'result' -> ('aim' | 'roundEnd') -> 'drinking' -> 'aim' ... -> 'over'
// A 'roundEnd' alatt a UI (main.js) mutatja az italválasztót, és a chooseDrink()-et hívja.
import * as C from './config.js';
import { W } from './config.js';
import { scoreAt } from './board.js';
import * as S from './scene.js';
import { clamp, lerp, rand, pick, noise1, TAU } from './util.js';

const HECKLES = [
  'Na, Eduárd, csak a tábla felé!',
  'Ez már a hányadik fröccs?',
  'Feri, tölts a bajnoknak!',
  'Vigyázz a cicára!',
  'Múltkor a plafont találtad el!',
  'Hármas húszat, Kománovics!',
  'Nem a pálinkát kell célozni!',
  'A falu büszkesége!',
  'Remeg a kezed, vagy a ház?',
  'Kettőt látsz? Célozz a középsőre!',
];

export const RANKS = [
  [0, 'Kocsmai kezdő'],
  [300, 'Törzsvendég'],
  [500, 'Falu bajnoka'],
  [700, 'Kocsmalegenda'],
  [900, 'Kománovics, a darts-király'],
];
export const rankFor = (score) => RANKS.filter(([min]) => score >= min).pop()[1];

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;
}

export class Game {
  /** deps: {sound, input, head, ui: {banner(text), onRoundEnd(summary), onGameOver(result)}} */
  constructor(deps) {
    Object.assign(this, deps);
    this.H = 700;
    this.anim = 0;
    this.state = 'menu';
    this.paused = false;
    this.L = S.computeLayout(this.H);
    this.reset();
  }

  resize(H, pixelScale) {
    this.H = H;
    this.L = S.computeLayout(H);
    this.pixelScale = pixelScale;
    this.bg = S.buildBackground(this.L, pixelScale);
    this.scene = document.createElement('canvas');
    this.scene.width = Math.ceil(W * pixelScale);
    this.scene.height = Math.ceil(H * pixelScale);
    this.sctx = this.scene.getContext('2d');
    if (!this.input.hasTarget) this.aim = { x: this.L.cx, y: this.L.cy };
  }

  reset() {
    this.state = 'menu';
    this.paused = false;
    this.round = 1;
    this.dartIdx = 0;
    this.total = 0;
    this.drunk = C.START_DRUNK;
    this.drink = 'froccs';
    this.mult = C.DRINKS.froccs.mult; // az üdvözlő fröccs szorzója az 1. körre
    this.coffeeUsed = false;
    this.roundDarts = [];
    this.history = [];
    this.stuck = [];
    this.flying = null;
    this.aim = { x: this.L.cx, y: this.L.cy };
    this.cross = { ...this.aim };
    this.hic = { x: 0, y: 0 };
    this.wobblePhase = rand(0, 100);
    this.hiccupTimer = rand(4, 8);
    this.charging = false;
    this.powerT = 0;
    this.power = 0;
    this.time = 0;
    this.resultT = 0;
    this.drinkT = 0;
    this.throwT = 0;
    this.floaters = [];
    this.particles = [];
    this.heckle = null;
    this.stats = { triples: 0, doubles: 0, bulls: 0, misses: 0, events: 0, best: 0 };
    this.props = {
      brokenBottle: -1,
      clockTilt: 0,
      clockStopped: 0,
      cat: { state: 'sit', t: 0, back: 0 },
      barman: { duckT: 0, angryT: 0, dartInHat: false },
    };
  }

  start() {
    this.reset();
    this.state = 'aim';
    this.sound.roundJingle();
    this.ui.banner('1. kör – üdvözlő fröccs! ×1,1');
    this.sayHeckle('Hajrá, Kománovics!');
  }

  get dartsLeft() {
    return C.DARTS_PER_ROUND - this.dartIdx;
  }

  // ================================================================= bemenet
  press() {
    if (this.paused || this.state !== 'aim') return false;
    this.charging = true;
    this.powerT = 0;
    return true;
  }
  release(cancel) {
    if (!this.charging) return;
    this.charging = false;
    if (cancel || this.paused || this.state !== 'aim') return;
    this.throwDart();
  }

  // ================================================================= UPDATE
  update(dt) {
    this.anim += dt;
    if (this.paused) return;
    this.input.update(dt);
    const L = this.L;
    if (this.state !== 'menu' && this.state !== 'over') this.time += dt;

    // --- célzás: célpont -> késleltetett követés -> remegés -> csuklás-rántás
    const tgt = this.input.hasTarget ? this.input.target : { x: L.cx, y: L.cy };
    tgt.x = clamp(tgt.x, 4, W - 4);
    tgt.y = clamp(tgt.y, 4, L.barTop + 40);
    const d = this.drunk;
    const tau = C.AIM_LAG_BASE + d * C.AIM_LAG_PER_DRUNK;
    const k = 1 - Math.exp(-dt / tau);
    this.aim.x += (tgt.x - this.aim.x) * k;
    this.aim.y += (tgt.y - this.aim.y) * k;
    const amp = C.WOBBLE_BASE + d * C.WOBBLE_PER_DRUNK;
    this.wobblePhase += dt * (1 + d / 120);
    const ph = this.wobblePhase;
    const wx = amp * (0.55 * Math.sin(ph * 1.7) + 0.25 * Math.sin(ph * 3.1 + 1.3) + 0.5 * noise1(ph * 0.9 + 3));
    const wy = amp * (0.5 * Math.cos(ph * 1.3 + 0.4) + 0.25 * Math.sin(ph * 2.7 + 2.1) + 0.5 * noise1(ph * 0.8 + 50));
    this.hic.x *= Math.exp(-dt * 4);
    this.hic.y *= Math.exp(-dt * 4);
    this.cross = { x: this.aim.x + wx + this.hic.x, y: this.aim.y + wy + this.hic.y };

    if (this.state === 'aim') {
      if (this.charging) {
        this.powerT += dt;
        const period = C.POWER_PERIOD / (1 + d / 200);
        this.power = (1 - Math.cos((this.powerT * TAU) / period)) / 2;
      }
      if (d > 20) {
        this.hiccupTimer -= dt;
        if (this.hiccupTimer <= 0) this.doHiccup();
      }
    } else if (this.state === 'flying') {
      this.flying.t += dt / C.FLIGHT_TIME;
      this.throwT = clamp(this.flying.t * 1.5, 0, 1);
      if (this.flying.t >= 1) this.land();
    } else if (this.state === 'result') {
      this.resultT -= dt;
      this.throwT = 0;
      if (this.resultT <= 0) this.nextDart();
    } else if (this.state === 'drinking') {
      this.drinkT += dt / 1.6;
      if (this.drinkT >= 1) this.beginRound();
    }

    // --- kellékek
    const P = this.props;
    P.barman.duckT = Math.max(0, P.barman.duckT - dt);
    P.barman.angryT = Math.max(0, P.barman.angryT - dt);
    if (P.cat.state === 'jump') {
      P.cat.t += dt;
      if (P.cat.t > 1.1) P.cat.state = 'gone';
    }
    P.clockTilt *= Math.exp(-dt * 0.5);

    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += (q.g ?? 300) * dt;
      q.rot += q.vr * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 28;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.heckle) {
      this.heckle.life -= dt;
      if (this.heckle.life <= 0) this.heckle = null;
    }
  }

  doHiccup() {
    this.hiccupTimer = rand(3, 8) * (1.3 - this.drunk / 150);
    this.sound.hiccup();
    const a = rand(0, TAU);
    const m = 14 + this.drunk * 0.35;
    this.hic.x += Math.cos(a) * m;
    this.hic.y += Math.sin(a) * m;
    this.floater('hukk!', this.L.head.cx + 40, this.L.head.cy - this.L.headH * 0.45, '#fff', 15);
  }

  sayHeckle(text) {
    this.heckle = { text: 'Pityu bá: ' + (text || pick(HECKLES)), life: 3.2 };
  }

  floater(text, x, y, color = '#fff', size = 18, life = 1.3) {
    this.floaters.push({ text, x: clamp(x, 60, W - 60), y: clamp(y, 86, this.H - 30), color, size, life, max: life });
  }
  burst(x, y, n, colors, speed = 120, g = 300, size = [2, 4]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.3, g, life: rand(0.5, 1.1), max: 1.1, size: rand(size[0], size[1]), color: pick(colors), rot: rand(0, TAU), vr: rand(-8, 8) });
    }
  }

  // ================================================================= dobás
  throwDart() {
    const p = this.power;
    let err = 0;
    if (p < C.POWER_SWEET_MIN) err = ((C.POWER_SWEET_MIN - p) / C.POWER_SWEET_MIN) * C.POWER_ERROR_PX; // gyenge: lejjebb esik
    else if (p > C.POWER_SWEET_MAX) err = -((p - C.POWER_SWEET_MAX) / (1 - C.POWER_SWEET_MAX)) * C.POWER_ERROR_PX * 0.45; // túl erős: feljebb
    const sd = 1.5 + this.drunk * 0.06;
    const x1 = this.cross.x + gauss() * sd;
    const y1 = this.cross.y + err + gauss() * sd;
    this.flying = { x0: this.L.hand.x, y0: this.L.hand.y, x1, y1, t: 0, power: p };
    this.state = 'flying';
    this.sound.whoosh();
  }

  /** Becsapódás: a találati pont feloldása és az összes következmény. */
  land() {
    const { x1: x, y1: y } = this.flying;
    this.flying = null;
    const L = this.L;
    const P = this.props;
    let res;
    const inRect = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const sc = scoreAt(x - L.cx, y - L.cy, L.s);
    if (sc) {
      res = { ...sc, bonus: 0, kind: 'board' };
      this.stuck.push({ x, y });
      this.sound.thunk('board');
      if (sc.ring === 'bull50') {
        this.stats.bulls++;
        this.sound.cheer(true);
        this.burst(x, y, 30, ['#ffd84d', '#ff4d5e', '#fff', '#3fb950'], 180, 200);
      } else if (sc.ring === 'bull25') {
        this.stats.bulls++;
        this.sound.cheer(false);
      } else if (sc.ring === 'triple') {
        this.stats.triples++;
        if (sc.num >= 15) this.sound.cheer(sc.num === 20);
        res.label = `Tripla ${sc.num}! ${sc.points}`;
      } else if (sc.ring === 'double') {
        this.stats.doubles++;
        res.label = `Dupla ${sc.num}! ${sc.points}`;
      } else if (sc.ring === 'surround') {
        this.stats.misses++;
        this.sound.groan();
        res.label = 'A tábla szélére!';
      }
    } else if (inRect(L.shelf) && P.brokenBottle < 0) {
      P.brokenBottle = clamp(Math.round((x - L.shelf.x - 10) / 17), 0, 3);
      P.barman.angryT = 2.5;
      this.sound.shatter();
      setTimeout(() => this.sound.ouch(), 350);
      this.burst(x, y, 22, ['#cfe8f5', '#ffffff', '#9bd1a0'], 160, 400, [1.5, 3.5]);
      res = { points: 0, bonus: -15, label: 'Üvegtörés! −15', kind: 'bottle' };
      this.sayHeckle('Ezt Feri a számládra írja!');
      this.stats.events++;
    } else if (P.cat.state === 'sit' && inRect(L.cat)) {
      // Cirmi NEM sérül: a nyíl a polcba áll mellé, ő ijedten elugrik.
      P.cat.state = 'jump';
      P.cat.t = 0;
      P.cat.back = this.round + 2;
      this.sound.meow();
      this.stuck.push({ x: clamp(x, L.cat.x, L.cat.x + L.cat.w), y: L.cat.y + L.cat.h - 4 });
      res = { points: 0, bonus: 0, label: 'Cirmi ijedten elugrik! MIÁÚ!', kind: 'cat' };
      this.sayHeckle('A macskát hagyd békén!');
      this.stats.events++;
    } else if (inRect(L.trophy)) {
      this.stuck.push({ x, y });
      this.sound.thunk('wood');
      this.sound.cheer(false);
      res = { points: 0, bonus: 10, label: 'Agancs-telitalálat! +10', kind: 'trophy' };
      this.stats.events++;
    } else if (Math.hypot(x - L.clock.x, y - L.clock.y) < L.clock.r) {
      this.stuck.push({ x, y });
      this.sound.bong();
      P.clockTilt = 0.5;
      P.clockStopped = this.anim;
      res = { points: 0, bonus: 0, label: 'Megállt az idő!', kind: 'clock' };
      this.sayHeckle('Mindjárt záróra, Eduárd!');
      this.stats.events++;
    } else if (inRect(L.barman) && !P.barman.dartInHat) {
      P.barman.dartInHat = true;
      P.barman.duckT = 1;
      P.barman.angryT = 3;
      this.sound.ouch();
      this.drunk = Math.min(100, this.drunk + 8);
      res = { points: 0, bonus: 0, label: 'Feri sapkájába! Büntetőfeles!', kind: 'barman' };
      this.sayHeckle('Feri büntetőfelest tölt neked!');
      this.stats.events++;
    } else if (y > L.barTop) {
      this.stuck.push({ x, y });
      this.sound.thunk('wood');
      res = { points: 0, bonus: 0, label: 'A pultba!', kind: 'counter' };
      this.stats.misses++;
    } else {
      this.stuck.push({ x, y });
      this.sound.thunk('wall');
      this.burst(x, y, 10, ['#d9b77a', '#c49a5a', '#efe0c0'], 70, 250, [1, 2.5]);
      res = { points: 0, bonus: 0, label: 'A falba!', kind: 'wall' };
      this.stats.misses++;
      if (Math.random() < 0.5) this.sound.groan();
    }
    res.x = x;
    res.y = y;
    this.roundDarts.push(res);
    const big = res.points >= 40 || res.kind !== 'board';
    this.floater(res.label, x, y - 18, res.points >= 50 ? '#ffd84d' : res.points > 0 ? '#ffffff' : '#ffb3a8', big ? 19 : 17, big ? 1.6 : 1.2);
    this.dartIdx++;
    this.state = 'result';
    this.resultT = big ? 1.0 : 0.7;

    // 180: mindhárom tripla 20
    if (this.dartIdx === 3 && this.roundDarts.every((r) => r.ring === 'triple' && r.num === 20)) {
      this.ui.banner('SZÁZNYOLCVAN!!!');
      this.sound.cheer(true);
      this.burst(L.cx, L.cy, 60, ['#ffd84d', '#ff4d5e', '#3fb950', '#4da3ff', '#fff'], 260, 250);
      this.resultT = 2;
    }
  }

  nextDart() {
    if (this.dartIdx < C.DARTS_PER_ROUND) {
      this.state = 'aim';
      this.charging = false;
      return;
    }
    this.endRound();
  }

  endRound() {
    const base = this.roundDarts.reduce((a, r) => a + r.points, 0);
    const bonus = this.roundDarts.reduce((a, r) => a + r.bonus, 0);
    const roundScore = Math.max(-this.total, Math.round(base * this.mult) + bonus);
    this.total += roundScore;
    this.stats.best = Math.max(this.stats.best, roundScore);
    const summary = {
      round: this.round,
      darts: this.roundDarts.map((r) => (r.kind === 'board' ? (r.ring === 'surround' ? 'Mellé' : r.label.replace(/!/g, '')) : r.label.split('!')[0])),
      base,
      mult: this.mult,
      bonus,
      roundScore,
      total: this.total,
      drunk: Math.round(this.drunk),
      coffeeUsed: this.coffeeUsed,
      last: this.round >= C.ROUNDS,
    };
    this.history.push(summary);
    if (summary.last) return this.finish(summary);
    this.state = 'roundEnd';
    if (base >= 100) this.sound.cheer(base >= 140);
    this.ui.onRoundEnd(summary);
  }

  /** Italválasztás a kör végén (main.js hívja). */
  chooseDrink(kind) {
    if (this.state !== 'roundEnd') return false;
    const D = C.DRINKS[kind];
    if (!D || (kind === 'kave' && this.coffeeUsed)) return false;
    this.drink = kind;
    this.mult = D.mult;
    if (kind === 'kave') this.coffeeUsed = true;
    this.drunk = clamp(this.drunk + D.drunk - C.DRUNK_DECAY_PER_ROUND, 0, 100);
    this.state = 'drinking';
    this.drinkT = 0;
    if (kind !== 'kave') {
      this.sound.pour();
      setTimeout(() => this.sound.clink(), 650);
    }
    setTimeout(() => this.sound.gulp(kind === 'palinka'), 800);
    // kihúzza a nyilakat, Feri visszaadja a sapkásat, a cica (két kör múlva) visszajön
    this.stuck = [];
    this.props.barman.dartInHat = false;
    if (this.props.cat.state === 'gone' && this.round + 1 >= this.props.cat.back) this.props.cat = { state: 'sit', t: 0, back: 0 };
    return true;
  }

  beginRound() {
    this.round++;
    this.dartIdx = 0;
    this.roundDarts = [];
    this.state = 'aim';
    this.drinkT = 0;
    this.hiccupTimer = rand(2, 6);
    this.sound.roundJingle();
    const m = this.mult.toLocaleString('hu-HU', { minimumFractionDigits: 1 });
    this.ui.banner(`${this.round}. kör – ${C.DRINKS[this.drink].name}: ×${m}${this.round === C.ROUNDS ? ' – utolsó kör!' : ''}`);
    if (Math.random() < 0.65) this.sayHeckle();
  }

  finish(summary) {
    this.state = 'over';
    this.charging = false;
    this.sound.stopMusic();
    this.sound.bell();
    this.ui.onGameOver({
      score: this.total,
      level: C.ROUNDS,
      durationSec: Math.round(this.time),
      stats: this.stats,
      rank: rankFor(this.total),
      last: summary,
      history: this.history,
    });
  }

  // ================================================================= DRAW
  draw(ctx) {
    const L = this.L;
    const H = this.H;
    const t = this.anim;
    const sc = this.sctx;
    // --- jelenet a saját vásznára (hogy a "dupla látás" kétszer is kirajzolhassa)
    sc.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    sc.drawImage(this.bg, 0, 0, W, H);
    S.drawProps(sc, L, this.props, t);
    for (const s of this.stuck) S.drawStuckDart(sc, s.x, s.y, 0.9);
    const handAngle = Math.atan2(this.cross.y - L.hand.y, this.cross.x - L.hand.x);
    S.drawKomanovics(
      sc,
      L,
      this.head,
      {
        sway: Math.sin(t * 0.9) * (this.drunk / 100) + noise1(t * 0.5) * (this.drunk / 200),
        drunk: this.drunk,
        throwT: this.state === 'flying' ? this.throwT : 0,
        drinkT: this.state === 'drinking' ? this.drinkT : 0,
        drink: this.drink,
        dartsLeft: this.state === 'aim' || this.state === 'menu' ? this.dartsLeft : 0,
        aimAngle: this.state === 'aim' ? handAngle : -0.9,
      },
      t,
    );
    if (this.flying) {
      const f = this.flying;
      const e = f.t;
      const x = lerp(f.x0, f.x1, e);
      const y = lerp(f.y0, f.y1, e) - Math.sin(Math.PI * e) * 46;
      const ang = Math.atan2(f.y1 - f.y0 - Math.cos(Math.PI * e) * 46 * Math.PI, f.x1 - f.x0);
      sc.save();
      sc.translate(x, y);
      sc.rotate(ang);
      S.drawDartSide(sc, lerp(1.5, 0.75, e) * (L.headH / 150));
      sc.restore();
    }
    for (const q of this.particles) {
      sc.save();
      sc.globalAlpha = clamp(q.life / q.max, 0, 1);
      sc.translate(q.x, q.y);
      sc.rotate(q.rot);
      sc.fillStyle = q.color;
      sc.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
      sc.restore();
    }

    // --- összeállítás: enyhe ringás + részegen dupla látás
    const d = this.drunk / 100;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(t * 0.8) * d * 0.03);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(this.scene, 0, 0, W, H);
    if (this.drunk > 35) {
      ctx.globalAlpha = ((this.drunk - 35) / 65) * 0.3;
      ctx.drawImage(this.scene, Math.sin(t * 0.9) * this.drunk * 0.08, Math.cos(t * 0.6) * this.drunk * 0.04, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // --- célkereszt + erőmérő (nem duplázódik)
    if (this.state === 'aim' && !this.paused) {
      S.drawCrosshair(ctx, this.cross.x, this.cross.y, this.drunk, t);
      if (this.charging) S.drawPowerMeter(ctx, this.cross.x, this.cross.y, this.power, C.POWER_SWEET_MIN, C.POWER_SWEET_MAX);
    }
    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1);
      ctx.font = `bold ${f.size}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30,15,5,0.9)';
      const hw = ctx.measureText(f.text).width / 2 + 6;
      const fx = clamp(f.x, hw, W - hw);
      ctx.strokeText(f.text, fx, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, f.y);
      ctx.restore();
    }
    if (this.heckle && this.state !== 'menu') {
      S.drawBubble(ctx, L.head.cx + 90, L.head.cy - L.headH * 0.52, this.heckle.text, clamp(this.heckle.life * 2, 0, 1), 13);
    }
    if (d > 0.2) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,170,90,0)');
      g.addColorStop(1, `rgba(150,40,20,${(d - 0.2) * 0.45})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
