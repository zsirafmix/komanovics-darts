// Játékállandók. Koordináták logikai egységekben: szélesség mindig W, magasság a képarányból (Game.resize).
export const W = 400;
export const ROUNDS = 8; // egy játék = 8 kör × 3 nyíl
export const DARTS_PER_ROUND = 3;
export const START_DRUNK = 10; // "üdvözlő fröccs"
export const DRUNK_DECAY_PER_ROUND = 4;

/** Italok: részegség-növekmény és a KÖVETKEZŐ kör pontszorzója. A kávé játékonként egyszer választható.
 *  Hangolva szimulációval (tools/_balance.mjs): pontos célzásnál a három ital várható pontja közel azonos,
 *  pontatlanabb célzásnál az erősebb ital többet ér, de nagyobb a szórás – ez a kockázat/jutalom. */
export const DRINKS = {
  froccs: { name: 'Fröccs', drunk: 8, mult: 1.1, desc: 'Könnyű, nyári' },
  sor: { name: 'Sör', drunk: 12, mult: 1.35, desc: 'Egy korsó csapolt' },
  palinka: { name: 'Pálinka', drunk: 20, mult: 1.7, desc: 'Kisüsti, erős' },
  kave: { name: 'Kávé', drunk: -30, mult: 1.0, desc: 'Csak egyszer!' },
};

// Célzás
export const WOBBLE_BASE = 3; // józanul is remeg egy kicsit (px)
export const WOBBLE_PER_DRUNK = 0.55; // +px részegség-egységenként (100-nál ~58 px)
export const AIM_LAG_BASE = 0.03; // s
export const AIM_LAG_PER_DRUNK = 0.0035; // s / részegség (100-nál ~0,38 s)
// Erőmérő: nyomva tartva oszcillál 0..1 között; az "édes" zónában nincs függőleges hiba.
export const POWER_PERIOD = 1.3; // s, józanul
export const POWER_SWEET_MIN = 0.58;
export const POWER_SWEET_MAX = 0.88;
export const POWER_ERROR_PX = 110; // teljes erőhiány esetén ennyivel esik lejjebb
export const FLIGHT_TIME = 0.32; // s
