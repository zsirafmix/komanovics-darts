// A játék-specifikus szerver-beállítások egy helyen.
// Ha új Kománovics-játékot készítesz ebből a sablonból, ezt a fájlt kell átírni.
export const GAME = {
  name: 'KOMÁNOVICS Darts',
  // Saját tábla a KÖZÖS Kománovics-adatbázisban (felülírható a SCORES_TABLE env-vel).
  defaultTable: 'darts_scores',
  limits: {
    // 8 kör × max 180 × max 1,7-es italszorzó ≈ 2450 (+ bónuszok); bőséges ráhagyással:
    scoreMax: 5000,
    // "level" itt = lejátszott körök száma (1..8)
    levelMax: 8,
    durationMaxSec: 2 * 60 * 60,
    // egy dobás + animáció legalább ~1 mp; 1 mp alatt legfeljebb ~90 pont reális
    maxPointsPerSec: 90,
    baseAllowance: 100,
    requireDuration: true,
  },
};
