// Bemenet a célzáshoz és dobáshoz.
// - Egér: a célkereszt követi az egeret; lenyomás = erőgyűjtés indul, felengedés = dobás.
// - Érintés: ujj lerakása = célzás az ujj FÖLÉ (TOUCH_OFFSET), hogy az ujj ne takarja; húzással igazítható;
//   nyomva tartva gyűlik az erő, elengedéskor dob.
// - Billentyűzet: nyilak = célpont mozgatása, Szóköz nyomva tartva = erő, felengedve = dobás.
// A Game a target-et olvassa, és a press/release callbackeket kapja.
import { W } from './config.js';

const TOUCH_OFFSET = 70; // logikai egység

export class Input {
  constructor(canvas, { onPress, onRelease, onPause } = {}) {
    this.canvas = canvas;
    this.target = { x: W / 2, y: 200 };
    this.hasTarget = false;
    this.pressing = false;
    this.keys = new Set();
    this.onPress = onPress;
    this.onRelease = onRelease;
    this.onPause = onPause;
    this.pointerId = null;

    const toLogical = (e) => {
      const r = canvas.getBoundingClientRect();
      const k = W / r.width;
      return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
    };
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.pointerId === this.pointerId) {
        const p = toLogical(e);
        this.target = { x: p.x, y: p.y - (e.pointerType === 'mouse' ? 0 : TOUCH_OFFSET) };
        this.hasTarget = true;
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      e.preventDefault();
      const p = toLogical(e);
      this.target = { x: p.x, y: p.y - (e.pointerType === 'mouse' ? 0 : TOUCH_OFFSET) };
      this.hasTarget = true;
      this.pointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      this.pressing = true;
      this.onPress?.();
    });
    const up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      if (this.pressing) {
        this.pressing = false;
        this.onRelease?.(e.type === 'pointercancel');
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
      if (k === ' ' || k === 'spacebar') {
        e.preventDefault();
        if (!e.repeat && !this.pressing && this.onPress?.(true) !== false) this.pressing = true;
      }
      if ((k === 'p' || k === 'escape') && !e.repeat) this.onPause?.();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if ((k === ' ' || k === 'spacebar') && this.pressing && this.pointerId === null) {
        this.pressing = false;
        this.onRelease?.(false);
      }
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (this.pressing) {
        this.pressing = false;
        this.pointerId = null;
        this.onRelease?.(true); // megszakított dobás
      }
    });
  }

  /** Billentyűs célzás képkockánként */
  update(dt) {
    const v = 180 * dt;
    if (this.keys.has('arrowleft')) this.target.x -= v;
    if (this.keys.has('arrowright')) this.target.x += v;
    if (this.keys.has('arrowup')) this.target.y -= v;
    if (this.keys.has('arrowdown')) this.target.y += v;
    if (this.keys.size) this.hasTarget = true;
  }
}
