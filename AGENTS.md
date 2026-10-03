# AGENTS.md – KOMÁNOVICS Darts

## START HERE FOR NEXT AGENT
1. Olvasd el ezt a fájlt, majd `docs/HANDOFF.md`-t (legutóbbi állapot) és `docs/ARCHITECTURE.md`-t.
2. `npm install && npm test && npm start` → http://localhost:3000. Vizuális ellenőrzés: `npm run smoke` (Chrome kell).
3. Élő: https://komanovics-darts.onrender.com – push után **kézzel** kell deployolni (MCP `trigger_deploy`), auto-deploy nincs.
4. A felhasználó szabálya minden Kománovics-játékra: **alkohol, részegség és Kománovics (Eduárd)** mindig legyen benne; minden játékbeli szöveg **magyar**.
5. Dokumentációs szabály: minden változásnál frissítsd a README/AGENTS/CHANGELOG/docs fájlokat (magyarul), leíró commit üzenetek, titok soha nem kerülhet a repóba.

## PROJECT GOAL
Böngészős, mobilon és asztalon is játszható kocsmai darts Kománovics Eduárddal: remegő célzás, amely a
részegséggel romlik, körönkénti italválasztás (kockázat/jutalom), vicces kocsmai események, online
top-10 ranglista. A Kománovics-játékcsalád része; a ranglista-tábla közös adatbázisra van tervezve.

## CURRENT STATUS
- 1.0.0 kész és élesítve (Render free, Frankfurt): https://komanovics-darts.onrender.com
- Ranglista: memóriában (nincs `DATABASE_URL`, lásd KNOWN_ISSUES KI-1); a kód Postgres-kész (`darts_scores` tábla).
- Tesztek: `npm test` 13/13, smoke OK (0 konzolhiba), élő API ellenőrizve.

## LAST COMPLETED TASK
Teljes játék + szerver + tesztek + dokumentáció elkészítése, GitHub repó létrehozása, Render web service
létrehozása és élő ellenőrzése (2026-10-03).

## CURRENT TASK
Nincs folyamatban lévő munka.

## NEXT TASK
Közös Kománovics Postgres bekötése, ha a felhasználó jóváhagyja (lásd docs/HANDOFF.md „Next exact step”
és docs/ROADMAP.md). Utána: valódi eszközös teszt, 301 mód.

## IMPORTANT FILES
| Fájl | Mire való |
|---|---|
| `public/js/game.js` | állapotgép, célzás, dobás, találat-feloldás, pontozás, rajzolás – a játék szíve |
| `public/js/config.js` | minden hangolható szám (italok, remegés, erőmérő) |
| `public/js/board.js` | tábla-geometria és `scoreAt` (unit tesztelve) |
| `public/js/scene.js` | elrendezés (`computeLayout`) és minden rajz |
| `public/js/main.js` | UI, HUD, képernyők, ranglista, `window.__KD` teszt-hook |
| `public/js/audio.js` | szintetizált hangok és zene |
| `server/gameConfig.js` | játék neve, alapértelmezett tábla, validálási határok |
| `server/store.js` | memória / Postgres tároló, táblanév-ellenőrzés |
| `tools/smoke.mjs`, `tools/balance.mjs` | headless végigjátszás; ital-egyensúly szimuláció |
| `render.yaml` | Render Blueprint (leírás; a szolgáltatás MCP-vel jött létre) |

## ARCHITECTURE SUMMARY
Egy Express folyamat: statikus frontend (`public/`, build nélkül) + `/api/scores` + `/healthz`.
Frontend: `main.js` → `Game` (update/draw rAF-ben) → `board.js` (pont), `scene.js` (rajz), `audio.js`, `input.js`.
Logikai koordináták: szélesség 400, magasság a képarányból. Tárolás: `DATABASE_URL` → Postgres (`SCORES_TABLE`
vagy `darts_scores`), különben memória. Részletek és diagramok: `docs/ARCHITECTURE.md`.

## HOW TO BUILD/RUN/TEST
```bash
npm install
npm start                 # :3000, memória ranglista
npm run dev               # --watch
npm test                  # node:test
npm run smoke             # headless Chrome (CHROME_PATH, SCREENSHOT_DIR, BASE_URL, SUBMIT=0)
npm run balance           # ital-egyensúly (P='{"palinka":{"mult":1.8}}')
```
Nincs build-lépés. Deploy: push a `main`-re, majd Render `trigger_deploy` (service ID: docs/HANDOFF.md).

## KNOWN ISSUES
Lásd `docs/KNOWN_ISSUES.md`: memóriabeli ranglista (KI-1), kliensoldali pontszámítás (KI-2), Render free
alvás (KI-3), nincs auto-deploy (KI-4), valódi eszközön nem tesztelt (KI-5), keskeny asztali nézet (KI-6),
csak egy játékmód (KI-7), szélesebb dupla/tripla gyűrű (KI-8).

## IMPORTANT TECHNICAL DECISIONS
- **Játék-specifikus tábla** (`darts_scores`) a közös adatbázis miatt; a táblanév regex-szel ellenőrzött, mert SQL-be interpolálódik.
- **Nyomva tartás + elengedés erőmérővel** a sima tap helyett: így van ügyességi elem a remegés mellett is; a billentyűzetes (Szóköz) és érintéses út ugyanazt a `press/release`-t hívja.
- **Érintésnél 70 px-es eltolás** felfelé, hogy az ujj ne takarja a célkeresztet.
- **Kocsmai, szélesebb dupla/tripla gyűrű** (13 mm) a mobilos játszhatóságért.
- **Ital-értékek szimulációval hangolva** (`tools/balance.mjs`): pontos célzásnál kiegyenlített, pontatlannál az erősebb ital éri meg – valódi kockázat/jutalom.
- **A cica soha nem sérül** – a nyíl mellé, a polcba áll; csak elugrik.
- **Minden hang szintetizált**, nincs hangfájl; emoji helyett inline SVG ikonok (headless/régi rendszereken is látszik).
- **Validálási határok játékonként** (`gameConfig.js`): max 5000 pont, ≤ 8 kör, kötelező játékidő, `score ≤ 100 + 90·mp`.

## DO NOT CHANGE / CAUTION AREAS
- `server/store.js` táblanév-ellenőrzés (`assertTableName`) – SQL-injekció elleni védelem; ne vedd ki.
- A közös adatbázis miatt **ne** nevezd át a `darts_scores` táblát és ne írj olyan SQL-t, ami más játék táblájához nyúl.
- `[hidden] { display: none !important; }` a CSS-ben – nélküle a `display:flex` képernyők nem tűnnek el.
- CSP: `script-src 'self'` – ne tegyél inline scriptet a HTML-be.
- `window.__KD` hook – a smoke teszt használja.
- Ha az italok/körök számát módosítod: a `server/gameConfig.js` határait és a `test/board.test.js` maximum-tesztjét is ellenőrizd.

## FAILED APPROACHES
Lásd `docs/TROUBLESHOOTING.md` „Sikertelen próbálkozások”: a tesztben elavult `cross`, a tábla közepét
takaró banner, a képen kívüli pohár, az első (fröccsöt túlzottan jutalmazó) ital-egyensúly, a balance-szimuláció végtelen ciklusa.

## OPEN QUESTIONS
- Mikor és milyen közös adatbázis lesz (ingyenes, 30 napig élő vagy fizetős)? Fizetős erőforráshoz a felhasználó jóváhagyása kell.
- Kell-e 301 mód / külön toplista módonként?
- Az érintéses 70 px-es eltolás kényelmes-e valódi telefonon?
