# Átadás – KOMÁNOVICS Darts

## Date
2026-10-03 (Europe/Budapest)

## Goal
Önálló, második Kománovics-játék: kocsmai darts Eduárddal (alkohol, részegség, Kománovics – a felhasználó
szabálya minden játékra), magyar szövegekkel, online top-10 ranglistával, saját repóban és saját Render
free web service-en; a toplista-tábla úgy tervezve, hogy több játék osztozhasson egy Postgres adatbázison.

## What was changed
- Új repó `zsirafmix/komanovics-darts`: teljes játék (`public/`), Express szerver (`server/`), tesztek, smoke és balance eszköz, Render Blueprint, magyar dokumentáció.
- A szerver a KOMÁNOVICS-ból származik, de általánosítva: konfigurálható táblanév (`SCORES_TABLE`, alap `darts_scores`), játékonkénti validálási határok (`server/gameConfig.js`), `/healthz` a játék nevét és a táblát is visszaadja.
- Ugyanebben a munkamenetben a KOMÁNOVICS repó is átállt a játék-specifikus `komanovics_scores` táblára (ott dokumentálva).

## Files modified
Minden fájl új: `package.json`, `.nvmrc`, `.gitignore`, `.env.example`, `render.yaml`,
`server/{index,app,store,validate,rateLimit,gameConfig}.js`,
`public/index.html`, `public/css/style.css`, `public/js/{main,game,board,scene,input,audio,config,api,util}.js`,
`public/assets/{eduard-head.png, eduard-head-128.png, eduard-full.jpg, favicon.png}` (a KOMÁNOVICS repóból),
`test/{validate,api,board}.test.js`, `tools/{smoke,balance}.mjs`, `docs/*`, `docs/img/*`, `README.md`, `AGENTS.md`, `CHANGELOG.md`.

## What works
- Teljes 8 körös játék: célzás (egér / érintés / nyilak), remegés + késés + csuklás, erőmérő, ívelt repülés, pontozás, „SZÁZNYOLCVAN!”.
- Italválasztás (fröccs / sör / pálinka / kávé egyszer), ivás-animáció, részegség-sáv szöveges fokozattal, dupla látás.
- Kocsmai események (Feri sapkája, Cirmi, üvegtörés, agancs, óra, pult, fal), Pityu bácsi beszólásai, rangok.
- Szintetizált hangok + mulatós háttérzene, megjegyzett némítás, szünet (P/Esc, tab-váltáskor automatikus).
- Ranglista API (validálás, rate limit), memória-fallback; élő Render szolgáltatás.

## What does not work
- Postgres nincs bekötve (KI-1) → a ranglista újraindításkor törlődik.
- 301 mód nincs (KI-7). Auto-deploy nincs (KI-4).

## Tests performed
- `npm test` (13 teszt: validálás, táblanév-biztonság, SSL-config, tábla-pontozás minden szektorra, italok, szerverhatárok vs. elméleti maximum, API: healthz/GET/POST/400/429).
- `npm run smoke` helyben (390×844 mobil + 1366×768 asztali): valódi egeres és érintéses dobás, teljes játék, események, kávé-tiltás, beküldés, 45 gyorsított játék.
- `npm run balance` (480 szimulált játék).
- Élő ellenőrzés: `/healthz`, `GET /api/scores`, teszt POST, smoke `BASE_URL=… SUBMIT=0`.

## Test results
- `npm test`: 13/13 OK.
- Smoke: OK, 0 konzol-/oldalhiba; valódi egér → találat, érintés → „BIKA! 50”; szimuláció mediánok ~750–900 (tökéletes célzás), max pont/mp ~24 (határ: 90).
- Balance (emberi célzási hibával): sd 4 px → fröccs/sör/pálinka medián ~705/667/652; sd 12 px → 482/509/562.
- Élő (2026-10-03 10:10–10:13 CEST): `/healthz` → `{"ok":true,"game":"KOMÁNOVICS Darts","storage":"memory","table":"darts_scores"}`;
  `GET /api/scores` → üres lista; teszt POST „Teszt” 321 pont → 201, rank 1; hihetetlen pont (4999 / 10 mp) → 400; `level: 9` → 400;
  smoke az élő URL-en (`SUBMIT=0`) → OK, 0 konzolhiba. A „Teszt” bejegyzést a következő deploy törölte (memóriatároló).

## Deploy
- Render service: `komanovics-darts`, ID: `srv-db0bftvavr4c73evbsd0`, free, Frankfurt, https://komanovics-darts.onrender.com
- Env: `NODE_VERSION=20`, `SCORES_TABLE=darts_scores`, `SCORE_RATE_LIMIT_PER_MIN=5` (nincs `DATABASE_URL`).
- Első deploy: `dep-db0bfuvavr4c73evc020` (commit `9fd6e69`), live 2026-10-03 10:10 CEST. A docs-frissítés után kézi `trigger_deploy`.

## Important discoveries
- A Render push-alapú auto-deploy nem működik ezeknél a repóknál (GitHub App hozzáférés hiányzik) → `trigger_deploy`.
- Workspace-enként egy ingyenes Postgres; a helyet az `allyoutuber` foglalja (lejár 2026-10-29).
- A hook-alapú tesztdobásnál a `game.cross`-t is be kell állítani (a dobás azt használja).

## Failed attempts
Lásd docs/TROUBLESHOOTING.md „Sikertelen próbálkozások” (elavult célkereszt a tesztben, banner pozíció, ital a képen kívül, első ital-egyensúly, szimuláció végtelen ciklusa).

## Known risks
- Memóriabeli ranglista: minden deploy/alvás törli.
- Kliensoldali pontszámítás (csalható).
- Valódi mobilon nem tesztelt (érintés-eltolás, hang, teljesítmény).

## Next exact step
Ha a felhasználó jóváhagyja a közös adatbázist: `DATABASE_URL` beállítása (MCP `update_environment_variables`)
a `komanovics-darts` és a `komanovics` szolgáltatáson → `trigger_deploy` mindkettőn → `/healthz` ellenőrzése
(`storage: postgres`, `table: darts_scores` ill. `komanovics_scores`).
