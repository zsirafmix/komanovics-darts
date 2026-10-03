// Darts tábla: geometria, pontozás és rajzolás.
// A sugarak milliméterben vannak (versenytábla-szerű, de a dupla/tripla gyűrű "kocsmai" módon
// kicsit szélesebb: 13 mm a szabványos 8 helyett – mobilon különben szinte eltalálhatatlan).
// A Game a px/mm skálát (s) a képernyőmérethez igazítja.
import { TAU } from './util.js';

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RING = { bull50: 8, bull25: 17, tripleIn: 95, tripleOut: 108, doubleIn: 157, doubleOut: 170, numbers: 198, surround: 225 };

/**
 * Pontozás egy találati pontra.
 * @param {number} dx px a tábla középpontjától (jobbra +)
 * @param {number} dy px (lefelé +)
 * @param {number} s px / mm
 * @returns {{points:number, label:string, ring:string, num?:number} | null} null = a táblán kívül
 */
export function scoreAt(dx, dy, s) {
  const r = Math.hypot(dx, dy) / s;
  if (r > RING.surround) return null;
  if (r <= RING.bull50) return { points: 50, label: 'BIKA! 50', ring: 'bull50' };
  if (r <= RING.bull25) return { points: 25, label: '25', ring: 'bull25' };
  if (r > RING.doubleOut) return { points: 0, label: 'Mellé!', ring: 'surround' };
  // szög: 0 = fent, az óramutató járása szerint nő
  let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
  a = (a + 9 + 360) % 360;
  const num = ORDER[Math.floor(a / 18) % 20];
  if (r >= RING.tripleIn && r <= RING.tripleOut) return { points: num * 3, label: `T${num} = ${num * 3}`, ring: 'triple', num };
  if (r >= RING.doubleIn) return { points: num * 2, label: `D${num} = ${num * 2}`, ring: 'double', num };
  return { points: num, label: String(num), ring: 'single', num };
}

/** A tábla kirajzolása (cx, cy középpont, s px/mm). Statikus – a Game előre rendereli. */
export function drawBoard(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  // árnyék a falon
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(6 * s, 10 * s, RING.surround * s + 4, 0, TAU);
  ctx.fill();
  // fa keret + fekete szivacs-szegély
  ctx.fillStyle = '#5a3418';
  ctx.beginPath();
  ctx.arc(0, 0, RING.surround * s + 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#151515';
  ctx.beginPath();
  ctx.arc(0, 0, RING.surround * s, 0, TAU);
  ctx.fill();

  const seg = (r0, r1, i, col) => {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180;
    const a1 = a0 + (18 * Math.PI) / 180;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r1 * s, a0, a1);
    ctx.arc(0, 0, r0 * s, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0; // a 20-as szegmens fekete
    const single = dark ? '#1c1c1c' : '#efe2bd';
    const ring = dark ? '#c8102e' : '#0d7c3d';
    seg(RING.bull25, RING.tripleIn, i, single);
    seg(RING.tripleIn, RING.tripleOut, i, ring);
    seg(RING.tripleOut, RING.doubleIn, i, single);
    seg(RING.doubleIn, RING.doubleOut, i, ring);
  }
  ctx.fillStyle = '#0d7c3d';
  ctx.beginPath();
  ctx.arc(0, 0, RING.bull25 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c8102e';
  ctx.beginPath();
  ctx.arc(0, 0, RING.bull50 * s, 0, TAU);
  ctx.fill();

  // drótháló
  ctx.strokeStyle = 'rgba(200,200,205,0.75)';
  ctx.lineWidth = Math.max(0.6, 1.1 * s);
  for (const r of [RING.bull50, RING.bull25, RING.tripleIn, RING.tripleOut, RING.doubleIn, RING.doubleOut]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * s, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 9 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * RING.bull25 * s, Math.sin(a) * RING.bull25 * s);
    ctx.lineTo(Math.cos(a) * RING.doubleOut * s, Math.sin(a) * RING.doubleOut * s);
    ctx.stroke();
  }
  // számok
  ctx.fillStyle = '#f4f1e8';
  ctx.font = `bold ${Math.round(22 * s)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 90) * Math.PI) / 180;
    ctx.save();
    ctx.translate(Math.cos(a) * RING.numbers * s, Math.sin(a) * RING.numbers * s);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(String(ORDER[i]), 0, 0);
    ctx.restore();
  }
  // csillogás (lámpafény)
  const g = ctx.createRadialGradient(-60 * s, -80 * s, 10, 0, 0, RING.surround * s);
  g.addColorStop(0, 'rgba(255,240,200,0.18)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, RING.surround * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}
