// Minden hang Web Audio API-val, futásidőben szintetizálva (nincs külső hangfájl).
// Alap: a KOMÁNOVICS játék audio.js-e (ugyanaz a burkológörbe/oszcillátor/zaj infrastruktúra),
// új effektekkel (nyíl-suhanás, becsapódás, tömeg-ováció, nyávogás, üvegtörés, ...) és új zenével
// (mulatós keringő 3/4-ben, harmonika + cimbalom-szerű pengetés) + halk kocsmai háttérzsivaj.
// Hangerő-lánc: [források] -> sfx / music / ambient gain -> master (némítás) -> kompresszor -> kimenet.
// A némítás localStorage-ben marad meg ('kd_muted').
const NOTE = (() => {
  const names = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  return (n) => {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    const midi = (Number(m[2]) + 1) * 12 + names[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
})();


// Mulatós keringő 3/4-ben: [hang, hossz nyolcadokban] (egy ütem = 6 nyolcad), 16 ütem.
const MELODY = [
  ['D5', 2], ['B4', 2], ['G4', 2],
  ['A4', 2], ['B4', 2], ['D5', 2],
  ['C5', 2], ['A4', 2], ['F#4', 2],
  ['A4', 4], ['D5', 2],
  ['C5', 2], ['B4', 2], ['A4', 2],
  ['F#4', 2], ['A4', 2], ['C5', 2],
  ['B4', 2], ['D5', 2], ['G5', 2],
  ['G5', 4], ['R', 2],
  ['E5', 2], ['G5', 2], ['E5', 2],
  ['C5', 2], ['E5', 2], ['G5', 2],
  ['D5', 2], ['B4', 2], ['G4', 2],
  ['B4', 4], ['D5', 2],
  ['C5', 2], ['A4', 2], ['F#4', 2],
  ['A4', 2], ['C5', 2], ['F#5', 2],
  ['G5', 2], ['D5', 2], ['B4', 2],
  ['G4', 4], ['R', 2],
];
const CH = {
  G: ['G2', ['D4', 'G4', 'B4']],
  D7: ['D3', ['C4', 'F#4', 'A4']],
  C: ['C3', ['E4', 'G4', 'C5']],
};
const CHORDS = ['G', 'G', 'D7', 'D7', 'D7', 'D7', 'G', 'G', 'C', 'C', 'G', 'G', 'D7', 'D7', 'G', 'G'];
const ALT_BASS = { G: 'D3', D7: 'A2', C: 'G2' };

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('kd_muted') === '1';
    this.musicOn = false;
    this._timer = null;
    this.bpm = 150; // keringő: negyed = 150 BPM
  }

  /** AudioContext létrehozása / folytatása. Felhasználói gesztusból hívd. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      // Enyhe kompresszor, hogy a sok egyszerre szóló effekt ne torzuljon.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0.2;
      this.music.connect(this.master);
      this.ambient = ctx.createGain();
      this.ambient.gain.value = 0;
      this.ambient.connect(this.master);
      // 1 mp fehérzaj puffer (csattanás, fröccsenés, ropogás)
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('kd_muted', m ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ---- alacsony szintű építőkockák ----
  _env(g, t, a, peak, d, sustain = 0, rel = 0.05, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (sustain > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
      g.gain.setValueAtTime(Math.max(sustain, 0.0001), t + a + d + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold + rel);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
  }
  _osc(type, freq, t, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  _noise(t, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }
  _gain(dest = this.sfx) {
    const g = this.ctx.createGain();
    g.connect(dest);
    return g;
  }
  _filter(type, freq, q, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }
  _ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ---- effektek ----
  hiccup(delay = 0) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + delay;
    const g = this._gain();
    this._env(g, t, 0.006, 0.5, 0.16);
    const o = this._osc('triangle', 280, t, 0.2, g);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    // torok-"kattanás": rövid sávszűrt zaj
    const g2 = this._gain();
    this._env(g2, t, 0.002, 0.35, 0.05);
    this._noise(t, 0.06, this._filter('bandpass', 1500, 2, g2));
  }

  clink() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [0, 0.07].forEach((dt, i) => {
      [2650, 3970, 5310].forEach((f, k) => {
        const g = this._gain();
        this._env(g, t + dt, 0.002, (0.18 / (k + 1)) * (i ? 0.5 : 1), 0.35 - k * 0.08);
        this._osc('sine', f * (1 + i * 0.03), t + dt, 0.4, g);
      });
    });
    // kortyolás: 3 mély "glugy"
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.12 + i * 0.09;
      const g = this._gain();
      this._env(g, tt, 0.01, 0.25, 0.07);
      const o = this._osc('sine', 260, tt, 0.08, g);
      o.frequency.exponentialRampToValueAtTime(130, tt + 0.07);
    }
  }

  /** Nyíl suhanása */
  whoosh() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.03, 0.25, 0.22);
    const bp = this._filter('bandpass', 700, 2, g);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    this._noise(t, 0.26, bp);
  }

  /** Becsapódás. kind: 'board' (parafa: tompa + drót-pendülés), 'wall' (vakolat), 'wood' (pult/polc) */
  thunk(kind = 'board') {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.002, kind === 'wall' ? 0.7 : 0.55, 0.12);
    this._noise(t, 0.12, this._filter('lowpass', kind === 'wall' ? 1400 : 800, 1, g));
    const g2 = this._gain();
    this._env(g2, t, 0.002, 0.6, kind === 'wood' ? 0.16 : 0.09);
    const o = this._osc('sine', kind === 'wood' ? 320 : 190, t, 0.2, g2);
    o.frequency.exponentialRampToValueAtTime(kind === 'wood' ? 180 : 80, t + 0.1);
    if (kind === 'board') {
      const g3 = this._gain();
      this._env(g3, t + 0.005, 0.002, 0.05, 0.25);
      this._osc('triangle', 2100 + Math.random() * 400, t, 0.3, g3);
    }
  }

  /** Kocsmai ováció: zajos "éljenzés" formánsokkal + taps. big: hosszabb, hangosabb */
  cheer(big = false) {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    const dur = big ? 2.2 : 1.2;
    const voices = big ? 9 : 5;
    for (let i = 0; i < voices; i++) {
      const t = t0 + Math.random() * 0.15;
      const g = this._gain();
      this._env(g, t, 0.08, 0.09, 0.2, 0.07, 0.5, dur - 0.6);
      const bp = this._filter('bandpass', 500 + Math.random() * 700, 3, g);
      const o = this._osc('sawtooth', 160 + Math.random() * 160, t, dur, bp);
      o.frequency.linearRampToValueAtTime(220 + Math.random() * 200, t + 0.3);
      o.frequency.linearRampToValueAtTime(140 + Math.random() * 100, t + dur);
    }
    const n = this._gain();
    this._env(n, t0, 0.1, 0.25, 0.3, 0.18, 0.6, dur - 0.6);
    this._noise(t0, dur + 0.5, this._filter('bandpass', 1200, 0.7, n));
    // taps: sok rövid, magas zajimpulzus
    const claps = big ? 40 : 18;
    for (let i = 0; i < claps; i++) {
      const t = t0 + 0.1 + Math.random() * dur;
      const g = this._gain();
      this._env(g, t, 0.001, 0.12, 0.04);
      this._noise(t, 0.05, this._filter('highpass', 1500, 1, g));
    }
  }

  /** Csalódott "óóóó" a tömegből */
  groan() {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const g = this._gain();
      this._env(g, t0, 0.1, 0.07, 0.2, 0.05, 0.3, 0.4);
      const bp = this._filter('bandpass', 450, 4, g);
      const f = 150 + Math.random() * 90;
      const o = this._osc('sawtooth', f, t0, 1, bp);
      o.frequency.linearRampToValueAtTime(f * 0.7, t0 + 0.9);
    }
  }

  meow() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.04, 0.3, 0.1, 0.22, 0.25, 0.25);
    const bp = this._filter('bandpass', 1400, 3, g);
    const o = this._osc('sawtooth', 520, t, 0.7, bp);
    o.frequency.linearRampToValueAtTime(880, t + 0.18);
    o.frequency.linearRampToValueAtTime(480, t + 0.6);
    bp.frequency.linearRampToValueAtTime(900, t + 0.6);
    // fújás
    const g2 = this._gain();
    this._env(g2, t + 0.6, 0.02, 0.2, 0.4);
    this._noise(t + 0.6, 0.45, this._filter('highpass', 3000, 1, g2));
  }

  /** A csapos "AÚ!"-ja */
  ouch() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.01, 0.35, 0.08, 0.25, 0.12, 0.2);
    const bp = this._filter('bandpass', 850, 5, g);
    const o = this._osc('sawtooth', 210, t, 0.45, bp);
    o.frequency.linearRampToValueAtTime(390, t + 0.08);
    o.frequency.linearRampToValueAtTime(170, t + 0.42);
    bp.frequency.linearRampToValueAtTime(650, t + 0.42);
  }

  shatter() {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t0, 0.002, 0.5, 0.35);
    this._noise(t0, 0.4, this._filter('highpass', 2500, 1, g));
    for (let i = 0; i < 14; i++) {
      const t = t0 + Math.random() * 0.35;
      const gg = this._gain();
      this._env(gg, t, 0.001, 0.08, 0.15);
      this._osc('sine', 2500 + Math.random() * 4500, t, 0.18, gg);
    }
  }

  bong() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [440, 880, 1320].forEach((f, i) => {
      const g = this._gain();
      this._env(g, t, 0.003, 0.25 / (i + 1), 1.2);
      const o = this._osc('sine', f, t, 1.3, g);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + 1.2);
    });
  }

  /** Töltés (fröccs/sör) */
  pour() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.05, 0.25, 0.1, 0.18, 0.15, 0.45);
    const bp = this._filter('bandpass', 900, 1.5, g);
    bp.frequency.linearRampToValueAtTime(1600, t + 0.7);
    this._noise(t, 0.8, bp);
  }

  /** Kortyolás + "Áhh" (+ pálinkánál köhécselés) */
  gulp(strong = false) {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.13;
      const g = this._gain();
      this._env(g, t, 0.01, 0.3, 0.08);
      const o = this._osc('sine', 240, t, 0.09, g);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    }
    const t = t0 + 0.45;
    const g2 = this._gain();
    this._env(g2, t, 0.05, 0.2, 0.1, 0.14, 0.3, 0.25);
    const o = this._osc('sawtooth', strong ? 230 : 180, t, 0.7, this._filter('bandpass', 750, 4, g2));
    o.frequency.linearRampToValueAtTime(strong ? 160 : 140, t + 0.65);
    if (strong) {
      for (let i = 0; i < 2; i++) {
        const tt = t + 0.75 + i * 0.22;
        const g = this._gain();
        this._env(g, tt, 0.005, 0.4, 0.12);
        this._noise(tt, 0.14, this._filter('bandpass', 600, 1, g));
      }
    }
  }

  /** Záróra-csengő (játék vége) */
  bell() {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      [880, 1390, 2090].forEach((f, i) => {
        const t = t0 + k * 0.45;
        const g = this._gain();
        this._env(g, t, 0.002, 0.18 / (i + 1), 1.0);
        this._osc('sine', f, t, 1.1, g);
      });
    }
  }

  /** Új kör jingle */
  roundJingle() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    ['G4', 'B4', 'D5'].forEach((n, i) => {
      const g = this._gain();
      this._env(g, t + i * 0.09, 0.005, 0.12, 0.2);
      this._osc('square', NOTE(n), t + i * 0.09, 0.22, this._filter('lowpass', 2500, 1, g));
    });
  }

  // ---- zene: harmonika-szerű polka, lookahead ütemezővel ----
  // Harmonika-hangszín: 3 enyhén elhangolt fűrészfog/négyszög ("musette" lebegés) + aluláteresztő.
  _accordion(freq, t, dur, vol) {
    const g = this.ctx.createGain();
    g.connect(this.music);
    this._env(g, t, 0.02, vol, 0.06, vol * 0.75, 0.06, Math.max(0, dur - 0.12));
    const lp = this._filter('lowpass', 2300, 0.8, g);
    [-9, 0, 9].forEach((cents, i) => {
      const o = this._osc(i === 1 ? 'square' : 'sawtooth', freq, t, dur, lp);
      o.detune.value = cents;
    });
  }
  _bass(freq, t, dur) {
    const g = this.ctx.createGain();
    g.connect(this.music);
    this._env(g, t, 0.01, 0.5, dur * 0.8);
    this._osc('triangle', freq, t, dur, g);
  }
  _chord(notes, t, dur) {
    notes.forEach((n) => this._accordion(NOTE(n), t, dur, 0.06));
  }

  /** Cimbalom-szerű pengetés: gyorsan lecsengő, két enyhén elhangolt háromszög + magas felhang */
  _pluck(freq, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.music);
    this._env(g, t, 0.003, vol, 0.45);
    this._osc('triangle', freq, t, 0.5, g).detune.value = -4;
    this._osc('triangle', freq * 2, t, 0.3, g).detune.value = 5;
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.1);
    this._startAmbient();
    const eighth = 60 / this.bpm / 2;
    const events = [];
    let pos = 0;
    for (const [n, len] of MELODY) {
      if (n !== 'R') events.push({ at: pos, kind: 'mel', n, len });
      pos += len;
    }
    const loopLen = pos; // 96 nyolcad (16 ütem × 6)
    CHORDS.forEach((c, bar) => {
      const [bass, notes] = CH[c];
      events.push({ at: bar * 6, kind: 'bass', n: bar % 2 ? ALT_BASS[c] : bass });
      events.push({ at: bar * 6 + 2, kind: 'chord', notes });
      events.push({ at: bar * 6 + 4, kind: 'chord', notes });
    });
    events.sort((a, b) => a.at - b.at);
    this._loopStart = this.ctx.currentTime + 0.1;
    this._nextIdx = 0;
    this._loopN = 0;
    const tick = () => {
      if (!this.musicOn) return;
      const ahead = this.ctx.currentTime + 0.25;
      for (;;) {
        const ev = events[this._nextIdx];
        const t = this._loopStart + (this._loopN * loopLen + ev.at) * eighth;
        if (t > ahead) break;
        if (t > this.ctx.currentTime - 0.05) {
          if (ev.kind === 'mel') {
            this._accordion(NOTE(ev.n), t, ev.len * eighth * 0.9, 0.09);
            if (this._loopN % 2 === 1) this._pluck(NOTE(ev.n) * 2, t, 0.05); // második körben cimbalom is
          } else if (ev.kind === 'bass') this._bass(NOTE(ev.n), t, eighth * 1.8);
          else this._chord(ev.notes, t, eighth * 0.8);
        }
        this._nextIdx++;
        if (this._nextIdx >= events.length) {
          this._nextIdx = 0;
          this._loopN++;
        }
      }
    };
    tick();
    this._timer = setInterval(tick, 50);
  }

  /** Halk kocsmai zsivaj: szűrt zaj lassú hangerő-hullámzással + időnként egy-egy "nevetés" */
  _startAmbient() {
    if (this._ambSrc) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 450;
    lp.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    const base = ctx.createGain();
    base.gain.value = 0.05;
    lfo.connect(lg).connect(base.gain);
    src.connect(lp).connect(base).connect(this.ambient);
    src.start();
    lfo.start();
    this._ambSrc = src;
    this.ambient.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this._timer);
    if (this.ctx) {
      this.music.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      this.ambient.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    }
    if (this._ambSrc) {
      const s = this._ambSrc;
      setTimeout(() => s.stop(), 1500);
      this._ambSrc = null;
    }
  }

  /** Szünet közben halkabb zene */
  duckMusic(on) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.05 : 0.2, this.ctx.currentTime, 0.1);
  }
}
