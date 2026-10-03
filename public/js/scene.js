// A kocsma jelenete: elrendezés (layout), statikus fal-háttér, csapos (Feri), kocsmacica (Cirmi),
// agancs, óra, italos polc, pult, előtérben Kománovics (Eduárd) a nyilakkal és az italával,
// valamint a nyilak, célkereszt és erőmérő rajzolása. Minden logikai koordinátában.
import { W } from './config.js';
import { RING, drawBoard } from './board.js';
import { TAU, clamp } from './util.js';

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elrendezés a képernyő-magasságból. A tábla a felső részen, alatta a csapos a pult mögött (jobbra),
 * a tábla "sarkaiban" a polc (bal fent), a cica (jobb fent), az agancs (bal lent), az óra (jobb lent).
 */
export function computeLayout(H) {
  const TOP = 58; // a felső HUD-sáv alatt kezdődik a tábla
  const surroundR = Math.min(172, H * 0.225);
  const s = surroundR / RING.surround;
  const cx = W / 2;
  const cy = TOP + surroundR;
  const boardBottom = cy + surroundR;
  const barTop = Math.min(boardBottom + 105, H - 130);
  const headH = clamp((H - barTop) * 0.6, 105, 200);
  const L = {
    H,
    s,
    cx,
    cy,
    surroundR,
    barTop,
    headH,
    shelf: { x: 4, y: TOP - 4, w: 74, h: 62 },
    cat: { x: 326, y: TOP - 8, w: 70, h: 66 },
    trophy: { x: 6, y: boardBottom - 92, w: 70, h: 84 },
    clock: { x: W - 40, y: boardBottom - 44, r: 26 },
    barman: { x: 292, y: barTop - 104, w: 92, h: 104 },
    // Kománovics feje és keze
    head: { cx: 128, cy: H - headH * 0.6 },
  };
  L.hand = { x: L.head.cx + headH * 0.95, y: L.head.cy - headH * 0.25 };
  L.drink = { x: Math.max(26, L.head.cx - headH * 0.62), y: H - headH * 0.18 };
  // az esetleges ütközés a jobb lenti órával kisebb képernyőn: ha az óra a csapossal fedné egymást, feljebb tesszük
  if (L.clock.y + L.clock.r > L.barman.y - 4) L.clock.y = L.barman.y - L.clock.r - 6;
  return L;
}

/** Statikus háttér előrenderelése (fal, lambéria, lámpafény, polc, agancs, óra számlap nélkül mozgó mutatók, pult, tábla). */
export function buildBackground(L, pixelScale) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * pixelScale);
  c.height = Math.ceil(L.H * pixelScale);
  const g = c.getContext('2d');
  g.scale(pixelScale, pixelScale);
  const rnd = mulberry32(77);
  const H = L.H;

  // vakolt, okkersárga fal
  const wall = g.createLinearGradient(0, 0, 0, L.barTop);
  wall.addColorStop(0, '#b98d4a');
  wall.addColorStop(1, '#a87a3c');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, L.barTop);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(90,60,25,0.07)' : 'rgba(255,230,180,0.06)';
    g.fillRect(rnd() * W, rnd() * L.barTop, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  // repedések
  g.strokeStyle = 'rgba(70,45,20,0.35)';
  g.lineWidth = 1;
  for (const [x, y] of [[30, L.cy + 20], [360, L.cy - 40], [180, L.barTop - 40]]) {
    g.beginPath();
    g.moveTo(x, y);
    let px = x;
    let py = y;
    for (let k = 0; k < 5; k++) {
      px += (rnd() - 0.5) * 14;
      py += 6 + rnd() * 8;
      g.lineTo(px, py);
    }
    g.stroke();
  }
  // lámpafény a táblára
  const lamp = g.createRadialGradient(L.cx, L.cy - 40, 20, L.cx, L.cy, L.surroundR * 1.6);
  lamp.addColorStop(0, 'rgba(255,225,150,0.35)');
  lamp.addColorStop(1, 'rgba(255,225,150,0)');
  g.fillStyle = lamp;
  g.fillRect(0, 0, W, L.barTop);

  // polc italosüvegekkel (bal fent) – a dinamikus rajz (törött üveg) a drawProps-ban
  // agancs (bal lent)
  drawTrophy(g, L.trophy);
  // pult hátsó fala (polcos, sötétebb)
  g.fillStyle = '#4a2c16';
  g.fillRect(0, L.barTop - 6, W, H - L.barTop + 6);
  // pult teteje
  const top = g.createLinearGradient(0, L.barTop, 0, L.barTop + 34);
  top.addColorStop(0, '#9a5e2c');
  top.addColorStop(0.3, '#7a4520');
  top.addColorStop(1, '#5a3216');
  g.fillStyle = top;
  g.fillRect(0, L.barTop, W, 34);
  g.fillStyle = 'rgba(255,220,170,0.25)';
  g.fillRect(0, L.barTop, W, 3);
  // pult eleje: lambéria deszkák
  for (let x = 0; x < W; x += 32) {
    g.fillStyle = (x / 32) % 2 ? '#5b3317' : '#653a1b';
    g.fillRect(x, L.barTop + 34, 32, H - L.barTop - 34);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x, L.barTop + 34, 2, H - L.barTop - 34);
  }
  // söröscsap a pulton (jobbra, a csapos előtt)
  g.fillStyle = '#c9ccd1';
  rrect(g, 262, L.barTop - 30, 10, 32, 3);
  g.fill();
  g.fillStyle = '#1b1b1b';
  rrect(g, 258, L.barTop - 44, 18, 16, 4);
  g.fill();
  g.fillStyle = '#e8c547';
  g.font = 'bold 7px sans-serif';
  g.textAlign = 'center';
  g.fillText('SÖR', 267, L.barTop - 33);
  // táblafelirat a pult fölött
  g.fillStyle = '#2b2b2b';
  rrect(g, 110, L.barTop - 26, 120, 22, 4);
  g.fill();
  g.strokeStyle = '#8a6a45';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#f2efe6';
  g.font = 'bold 12px "Trebuchet MS", sans-serif';
  g.fillText('VIDÁM KECSKE', 170, L.barTop - 11);

  drawBoard(g, L.cx, L.cy, L.s);
  // sarok-vignetta
  const v = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,8,0,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

function drawTrophy(g, r) {
  const x = r.x + r.w / 2;
  const y = r.y + r.h * 0.62;
  // fa pajzs
  g.fillStyle = '#6b3f1d';
  g.beginPath();
  g.moveTo(x - 16, y - 6);
  g.lineTo(x + 16, y - 6);
  g.lineTo(x + 12, y + 22);
  g.lineTo(x, y + 30);
  g.lineTo(x - 12, y + 22);
  g.closePath();
  g.fill();
  // agancs
  g.strokeStyle = '#e9dcc0';
  g.lineCap = 'round';
  g.lineWidth = 4;
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sd * 6, y - 12);
    g.quadraticCurveTo(x + sd * 22, y - 30, x + sd * 18, y - 52);
    g.moveTo(x + sd * 15, y - 26);
    g.lineTo(x + sd * 30, y - 34);
    g.moveTo(x + sd * 19, y - 40);
    g.lineTo(x + sd * 31, y - 52);
    g.moveTo(x + sd * 12, y - 20);
    g.lineTo(x + sd * 4, y - 36);
    g.stroke();
  }
  // őzfej
  g.fillStyle = '#9a6a3c';
  ellipse(g, x, y, 11, 15);
  g.fill();
  ellipse(g, x - 12, y - 10, 6, 3, -0.5);
  g.fill();
  ellipse(g, x + 12, y - 10, 6, 3, 0.5);
  g.fill();
  g.fillStyle = '#2a1a0e';
  ellipse(g, x, y + 13, 4, 3);
  g.fill();
  g.fillStyle = '#111';
  ellipse(g, x - 5, y - 4, 1.8, 1.8);
  g.fill();
  ellipse(g, x + 5, y - 4, 1.8, 1.8);
  g.fill();
}

/** Dinamikus kellékek: polc üvegekkel, óra, kocsmacica, csapos. state: Game.props */
export function drawProps(ctx, L, P, t) {
  // ---- polc
  const sh = L.shelf;
  ctx.fillStyle = '#5a3418';
  ctx.fillRect(sh.x, sh.y + sh.h - 8, sh.w, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(sh.x + 2, sh.y + sh.h, sh.w, 4);
  const bottles = [
    { c: '#2f7a2f', h: 44, label: '#f2e3b3' },
    { c: '#7a3b1a', h: 38, label: '#e8c547' },
    { c: '#d9e6f0', h: 48, label: '#c0392b' },
    { c: '#3a2a6a', h: 36, label: '#ddd' },
  ];
  bottles.forEach((b, i) => {
    const bx = sh.x + 10 + i * 17;
    const by = sh.y + sh.h - 8;
    if (P.brokenBottle === i) {
      ctx.fillStyle = 'rgba(200,220,230,0.7)';
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx - 4, by - 9);
      ctx.lineTo(bx - 1, by - 5);
      ctx.lineTo(bx + 2, by - 11);
      ctx.lineTo(bx + 6, by);
      ctx.fill();
      return;
    }
    ctx.fillStyle = b.c;
    rrect(ctx, bx - 6, by - b.h * 0.6, 12, b.h * 0.6, 3);
    ctx.fill();
    ctx.fillRect(bx - 2.5, by - b.h, 5, b.h * 0.42);
    ctx.fillStyle = b.label;
    ctx.fillRect(bx - 6, by - b.h * 0.45, 12, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx - 4, by - b.h * 0.55, 2, b.h * 0.45);
  });

  // ---- óra
  const ck = L.clock;
  ctx.save();
  ctx.translate(ck.x, ck.y);
  ctx.rotate(P.clockTilt || 0);
  ctx.fillStyle = '#3b2412';
  ellipse(ctx, 0, 0, ck.r, ck.r);
  ctx.fill();
  ctx.fillStyle = '#f4eedc';
  ellipse(ctx, 0, 0, ck.r - 4, ck.r - 4);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (ck.r - 6), Math.sin(a) * (ck.r - 6));
    ctx.lineTo(Math.cos(a) * (ck.r - 9), Math.sin(a) * (ck.r - 9));
    ctx.stroke();
  }
  const clockT = P.clockStopped ? P.clockStopped : t;
  const hr = (clockT / 60) * TAU * 0.2 - Math.PI / 2;
  const mn = clockT * TAU * 0.05 - Math.PI / 2;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(hr) * 9, Math.sin(hr) * 9);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(mn) * 15, Math.sin(mn) * 15);
  ctx.stroke();
  ctx.restore();

  // ---- kocsmacica (Cirmi) a jobb felső polcon
  const c = L.cat;
  ctx.fillStyle = '#5a3418';
  ctx.fillRect(c.x - 4, c.y + c.h - 6, c.w + 8, 7);
  if (P.cat.state !== 'gone') drawCat(ctx, c, P.cat, t);

  // ---- csapos (Feri) a pult mögött
  drawBarman(ctx, L.barman, P.barman, t);
}

function drawCat(ctx, c, cat, t) {
  const k = cat.state === 'jump' ? cat.t : 0;
  const x = c.x + c.w / 2 + (cat.state === 'jump' ? k * 120 : 0);
  const y = c.y + c.h - 6 - (cat.state === 'jump' ? Math.sin(Math.min(1, k * 2) * Math.PI) * 30 : 0);
  ctx.save();
  ctx.translate(x, y);
  const orange = '#e08a2e';
  const stripe = '#a85a14';
  // farok
  ctx.strokeStyle = orange;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, -6);
  const sw = Math.sin(t * 2.2) * 8;
  ctx.quadraticCurveTo(30, -10, 26 + sw * 0.4, -30 + sw);
  ctx.stroke();
  // test
  ctx.fillStyle = orange;
  if (cat.state === 'jump') {
    ellipse(ctx, 0, -14, 20, 10); // kinyújtózott, ijedt
  } else {
    ellipse(ctx, 0, -16, 15, 17);
  }
  ctx.fill();
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 2;
  for (const yy of [-24, -17, -10]) {
    ctx.beginPath();
    ctx.moveTo(-10, yy);
    ctx.quadraticCurveTo(0, yy + 3, 10, yy);
    ctx.stroke();
  }
  // fej
  const hx = cat.state === 'jump' ? -16 : -2;
  const hy = cat.state === 'jump' ? -22 : -38;
  ctx.fillStyle = orange;
  ellipse(ctx, hx, hy, 11, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 4);
  ctx.lineTo(hx - 8, hy - 16);
  ctx.lineTo(hx - 2, hy - 8);
  ctx.moveTo(hx + 10, hy - 4);
  ctx.lineTo(hx + 8, hy - 16);
  ctx.lineTo(hx + 2, hy - 8);
  ctx.fill();
  // szemek: pislog
  const blink = Math.sin(t * 0.9) > 0.97;
  ctx.fillStyle = cat.state === 'jump' ? '#fff' : '#9bd14a';
  if (blink && cat.state !== 'jump') {
    ctx.fillStyle = '#5a3a14';
    ctx.fillRect(hx - 7, hy - 1, 5, 1.5);
    ctx.fillRect(hx + 2, hy - 1, 5, 1.5);
  } else {
    ellipse(ctx, hx - 4.5, hy - 1, 2.8, cat.state === 'jump' ? 3.5 : 2.4);
    ctx.fill();
    ellipse(ctx, hx + 4.5, hy - 1, 2.8, cat.state === 'jump' ? 3.5 : 2.4);
    ctx.fill();
    ctx.fillStyle = '#111';
    ellipse(ctx, hx - 4.5, hy - 1, 0.9, 2);
    ctx.fill();
    ellipse(ctx, hx + 4.5, hy - 1, 0.9, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f19aa0';
  ellipse(ctx, hx, hy + 3, 1.6, 1.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.8;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + sd * 3, hy + 4);
    ctx.lineTo(hx + sd * 14, hy + 2);
    ctx.moveTo(hx + sd * 3, hy + 5);
    ctx.lineTo(hx + sd * 13, hy + 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarman(ctx, b, st, t) {
  const duck = st.duckT > 0 ? Math.sin(Math.min(1, st.duckT) * Math.PI) * 26 : 0;
  const x = b.x + b.w / 2;
  const y = b.y + b.h + duck; // alsó pont = pult teteje
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - 20, b.y - 40, b.w + 40, b.h + 40); // a pult eltakarja az alsó részt
  ctx.clip();
  // test: fehér ing, fekete mellény
  ctx.fillStyle = '#f2f2ee';
  ellipse(ctx, x, y - 18, 34, 34);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 40);
  ctx.lineTo(x - 8, y - 46);
  ctx.lineTo(x - 4, y);
  ctx.lineTo(x - 34, y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 30, y - 40);
  ctx.lineTo(x + 8, y - 46);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x + 34, y);
  ctx.closePath();
  ctx.fill();
  // csokornyakkendő
  ctx.fillStyle = '#b3241c';
  ctx.beginPath();
  ctx.moveTo(x, y - 48);
  ctx.lineTo(x - 7, y - 52);
  ctx.lineTo(x - 7, y - 44);
  ctx.closePath();
  ctx.moveTo(x, y - 48);
  ctx.lineTo(x + 7, y - 52);
  ctx.lineTo(x + 7, y - 44);
  ctx.closePath();
  ctx.fill();
  // fej
  ctx.fillStyle = '#e9b48f';
  ellipse(ctx, x, y - 70, 17, 19);
  ctx.fill();
  ctx.fillStyle = '#5a3a22';
  ellipse(ctx, x - 16, y - 70, 4, 7);
  ctx.fill();
  ellipse(ctx, x + 16, y - 70, 4, 7);
  ctx.fill();
  // svájci sapka (ide állhat bele a nyíl)
  ctx.fillStyle = '#2b3a55';
  ellipse(ctx, x + 2, y - 86, 19, 8, -0.1);
  ctx.fill();
  ctx.fillRect(x + 1, y - 96, 3, 4);
  // bajusz
  ctx.fillStyle = '#2a1a0e';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 61);
  ctx.quadraticCurveTo(x, y - 69, x + 13, y - 61);
  ctx.quadraticCurveTo(x, y - 63, x - 13, y - 61);
  ctx.fill();
  // szemek
  const surprised = st.duckT > 0 || st.angryT > 0;
  ctx.fillStyle = '#fff';
  ellipse(ctx, x - 6, y - 74, 3.4, surprised ? 4 : 2.6);
  ctx.fill();
  ellipse(ctx, x + 6, y - 74, 3.4, surprised ? 4 : 2.6);
  ctx.fill();
  ctx.fillStyle = '#222';
  ellipse(ctx, x - 6, y - 74, 1.5, 1.5);
  ctx.fill();
  ellipse(ctx, x + 6, y - 74, 1.5, 1.5);
  ctx.fill();
  if (st.angryT > 0) {
    ctx.strokeStyle = '#2a1a0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 81);
    ctx.lineTo(x - 3, y - 78);
    ctx.moveTo(x + 10, y - 81);
    ctx.lineTo(x + 3, y - 78);
    ctx.stroke();
  }
  // törölgetett pohár + rongy (bal kéz)
  const pol = Math.sin(t * 5) * 4;
  ctx.fillStyle = 'rgba(220,235,240,0.8)';
  rrect(ctx, x - 44, y - 40 + pol, 14, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#e8e2cf';
  ellipse(ctx, x - 37, y - 22 + pol, 10, 6, 0.3);
  ctx.fill();
  // a sapkába állt nyíl
  if (st.dartInHat) drawStuckDart(ctx, x + 10, y - 89, 0.9, '#c8102e');
  ctx.restore();
}

// ------------------------------------------------------------------ Kománovics az előtérben
/**
 * pose: {sway, drunk, aiming, throwT (0..1 dobás-mozdulat), drinkT (0..1 ivás), drink: 'froccs'|'sor'|'palinka'|'kave', dartsLeft}
 */
export function drawKomanovics(ctx, L, head, pose, t) {
  const hh = L.headH;
  const H = L.H;
  const sway = pose.sway;
  ctx.save();
  // a teljes alak billeg a részegséggel
  ctx.translate(L.head.cx, H);
  ctx.rotate(sway * 0.06);
  ctx.translate(-L.head.cx, -H);
  // test: krém pulóver lyukakkal
  const bx = L.head.cx + 6;
  const by = H + hh * 0.18;
  ctx.fillStyle = '#efe6cf';
  ellipse(ctx, bx, by, hh * 0.92, hh * 0.62);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,130,90,0.6)';
  ctx.lineWidth = 2;
  ellipse(ctx, bx, by, hh * 0.92, hh * 0.62);
  ctx.stroke();
  for (const [ox, oy, r] of [[-0.45, -0.28, 0.09], [0.35, -0.12, 0.07], [0.6, -0.32, 0.05]]) {
    ctx.fillStyle = '#c99a7e';
    ellipse(ctx, bx + ox * hh, by + oy * hh, r * hh + 2, r * hh * 0.7 + 2, 0.4);
    ctx.fill();
    ctx.fillStyle = '#eba58c';
    ellipse(ctx, bx + ox * hh, by + oy * hh, r * hh, r * hh * 0.7, 0.4);
    ctx.fill();
  }
  // bal kar az itallal
  const dk = pose.drinkT || 0; // 0..1 ivás közben a szájhoz emeli
  const mouth = { x: L.head.cx + hh * 0.05, y: L.head.cy + hh * 0.3 };
  const gx = L.drink.x + (mouth.x - L.drink.x) * Math.sin(dk * Math.PI);
  const gy = L.drink.y + (mouth.y - L.drink.y) * Math.sin(dk * Math.PI);
  // karok: körvonal + krém pulóver-ujj (két szakasz: felkar + alkar)
  const limb = (pts, w) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [col, lw] of [['rgba(120,100,70,0.75)', w + 3], ['#e8dec4', w]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 3) ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      else ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }
  };
  limb([{ x: bx - hh * 0.55, y: H - hh * 0.02 }, { x: gx - hh * 0.2, y: gy + hh * 0.3 }, { x: gx, y: gy + hh * 0.1 }], hh * 0.17);
  // jobb kar (dobó kar): felkar vízszintesen ki, alkar felfelé, a kéz szemmagasságban
  const th = pose.throwT || 0;
  const hand = {
    x: L.hand.x + Math.sin(th * Math.PI) * hh * 0.18,
    y: L.hand.y - Math.sin(th * Math.PI) * hh * 0.25,
  };
  const shoulder = { x: bx + hh * 0.5, y: H - hh * 0.14 };
  const elbow = { x: L.hand.x + hh * 0.1, y: H - hh * 0.2 };
  limb([shoulder, elbow], hh * 0.17);
  limb([elbow, { x: hand.x, y: hand.y + hh * 0.08 }], hh * 0.15);
  ctx.fillStyle = '#d8cdb0';
  ellipse(ctx, hand.x, hand.y + hh * 0.1, hh * 0.08, hh * 0.035);
  ctx.fill();

  // fej (a felhasználó saját karakterének kivágott feje)
  const headSway = Math.sin(t * 1.3) * pose.drunk * 0.0015 + sway * 0.04;
  ctx.save();
  ctx.translate(L.head.cx, L.head.cy);
  ctx.rotate(headSway);
  if (pose.drunk > 50) {
    // részegen pirosabb arc: halvány pír a fej mögött
    ctx.fillStyle = `rgba(255,80,80,${(pose.drunk - 50) / 400})`;
    ellipse(ctx, 0, 0, hh * 0.5, hh * 0.5);
    ctx.fill();
  }
  if (head && head.complete && head.naturalWidth) {
    const hw = (head.naturalWidth / head.naturalHeight) * hh;
    ctx.drawImage(head, -hw / 2, -hh / 2, hw, hh);
  } else {
    ctx.fillStyle = '#b8481f';
    ellipse(ctx, 0, 0, hh * 0.45, hh * 0.5);
    ctx.fill();
  }
  ctx.restore();

  // ital a bal kézben
  drawGlass(ctx, gx, gy, hh / 150, pose.drink, dk);
  ctx.fillStyle = '#eeb39a';
  ellipse(ctx, gx - hh * 0.02, gy + hh * 0.09, hh * 0.07, hh * 0.06);
  ctx.fill();
  // dobó kéz + nyíl
  if (pose.dartsLeft > 0 && th < 0.5) {
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(pose.aimAngle ?? -0.9);
    drawDartSide(ctx, hh / 150);
    ctx.restore();
  }
  ctx.fillStyle = '#eeb39a';
  ellipse(ctx, hand.x, hand.y + hh * 0.03, hh * 0.075, hh * 0.065);
  ctx.fill();
  ctx.restore();
}

/** Italok rajza (k = skála). drinkT>0: billen (iszik), és fogy a tartalom. */
export function drawGlass(ctx, x, y, k, kind = 'froccs', drinkT = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.rotate(-Math.sin(drinkT * Math.PI) * 0.9);
  const level = 1 - Math.min(1, drinkT * 1.6) * 0.9;
  if (kind === 'sor') {
    ctx.fillStyle = 'rgba(230,240,245,0.55)';
    rrect(ctx, -16, -26, 32, 44, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18, -4, 9, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#e8a317';
    const h = 38 * level;
    ctx.fillRect(-13, 15 - h, 26, h);
    ctx.fillStyle = '#fffaf0';
    ellipse(ctx, 0, 15 - h, 14, 5);
    ctx.fill();
  } else if (kind === 'palinka') {
    ctx.fillStyle = 'rgba(230,240,245,0.6)';
    ctx.beginPath();
    ctx.moveTo(-9, -12);
    ctx.lineTo(9, -12);
    ctx.lineTo(6, 12);
    ctx.lineTo(-6, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,150,0.85)';
    const h = 18 * level;
    ctx.fillRect(-6.5, 11 - h, 13, h);
  } else if (kind === 'kave') {
    ctx.fillStyle = '#fff';
    rrect(ctx, -12, -8, 24, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(13, 1, 5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#5b3417';
    ellipse(ctx, 0, -7, 10, 3);
    ctx.fill();
  } else {
    // fröccs: talpas pohár, halvány fehérbor + buborékok
    ctx.fillStyle = 'rgba(230,240,245,0.55)';
    ctx.beginPath();
    ctx.moveTo(-12, -24);
    ctx.lineTo(12, -24);
    ctx.lineTo(9, 6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-2, 6, 4, 12);
    ctx.fillRect(-9, 17, 18, 3);
    ctx.fillStyle = 'rgba(240,230,150,0.75)';
    const h = 26 * level;
    ctx.beginPath();
    ctx.moveTo(-9 - (h / 30) * 3, 5 - h);
    ctx.lineTo(9 + (h / 30) * 3, 5 - h);
    ctx.lineTo(9, 5);
    ctx.lineTo(-9, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, -4 + i * 3, 2 - ((Date.now() / 200 + i * 7) % Math.max(1, h)), 0.9, 0.9);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Oldalnézetes nyíl (kézben / repülés közben), hegye a +x irányba. */
export function drawDartSide(ctx, k = 1, flight = '#c8102e') {
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = '#cfd3d8';
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(18, -1.5);
  ctx.lineTo(18, 1.5);
  ctx.fill();
  ctx.fillStyle = '#4a4f57';
  rrect(ctx, 4, -3, 15, 6, 2);
  ctx.fill();
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 0.8;
  for (let i = 6; i < 18; i += 2.5) {
    ctx.beginPath();
    ctx.moveTo(i, -3);
    ctx.lineTo(i, 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#222';
  ctx.fillRect(-10, -1.2, 15, 2.4);
  ctx.fillStyle = flight;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-16, -9);
  ctx.lineTo(-20, -8);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-20, 8);
  ctx.lineTo(-16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Beállt nyíl szemből-oldalról: a hegy a találati ponton, a szár a néző felé (lefelé-jobbra) áll ki. */
export function drawStuckDart(ctx, x, y, k = 1, flight = '#c8102e') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ellipse(ctx, 5, 9, 7, 2.5, 0.5);
  ctx.fill();
  ctx.strokeStyle = '#4a4f57';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7, 10);
  ctx.stroke();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(7, 10);
  ctx.lineTo(12, 17);
  ctx.stroke();
  ctx.fillStyle = flight;
  ctx.beginPath();
  ctx.moveTo(11, 15);
  ctx.lineTo(19, 15);
  ctx.lineTo(18, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, 15);
  ctx.lineTo(9, 24);
  ctx.lineTo(15, 23);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ddd';
  ellipse(ctx, 0, 0, 1.4, 1.4);
  ctx.fill();
  ctx.restore();
}

export function drawCrosshair(ctx, x, y, drunk, t) {
  const r = 14 + drunk * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of [[r - 6, r + 8]]) {
    ctx.moveTo(-b, 0);
    ctx.lineTo(-a, 0);
    ctx.moveTo(a, 0);
    ctx.lineTo(b, 0);
    ctx.moveTo(0, -b);
    ctx.lineTo(0, -a);
    ctx.moveTo(0, a);
    ctx.lineTo(0, b);
  }
  ctx.stroke();
  ctx.fillStyle = '#ffd84d';
  ellipse(ctx, 0, 0, 1.8, 1.8);
  ctx.fill();
  ctx.restore();
}

/** Függőleges erőmérő a célkereszt mellett. p 0..1, sweet zóna zölddel. */
export function drawPowerMeter(ctx, x, y, p, sweetMin, sweetMax) {
  const h = 64;
  const w = 11;
  const left = x + 26 > W - 20 ? x - 26 - w : x + 26;
  const top = clamp(y - h / 2, 4, 9999);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rrect(ctx, left - 2, top - 2, w + 4, h + 4, 4);
  ctx.fill();
  const grd = ctx.createLinearGradient(0, top + h, 0, top);
  grd.addColorStop(0, '#d64545');
  grd.addColorStop(sweetMin - 0.08, '#f5a623');
  grd.addColorStop(sweetMin, '#3fb950');
  grd.addColorStop(sweetMax, '#3fb950');
  grd.addColorStop(Math.min(1, sweetMax + 0.06), '#f5a623');
  ctx.fillStyle = grd;
  rrect(ctx, left, top, w, h, 3);
  ctx.fill();
  const py = top + h - p * h;
  ctx.fillStyle = '#fff';
  ctx.fillRect(left - 4, py - 1.5, w + 8, 3);
  ctx.restore();
}

export function drawBubble(ctx, x, y, text, alpha = 1, size = 14) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  const w = ctx.measureText(text).width + 18;
  const bx = clamp(x - w / 2, 4, W - w - 4);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  rrect(ctx, bx, y - size - 14, w, size + 12, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clamp(x, bx + 10, bx + w - 10) - 6, y - 3);
  ctx.lineTo(clamp(x, bx + 10, bx + w - 10), y + 7);
  ctx.lineTo(clamp(x, bx + 10, bx + w - 10) + 6, y - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + 9, y - 8);
  ctx.restore();
}
