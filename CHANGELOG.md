# Változásnapló

Formátum: [Keep a Changelog](https://keepachangelog.com/hu/1.1.0/), dátumok Europe/Budapest szerint.

## [1.0.0] – 2026-10-03
### Hozzáadva
- Teljes, 8 körös kocsmai darts játék Kománovics Eduárddal (Canvas 2D, ES modulok, build nélkül).
- Remegő, késleltetett célzás (a részegséggel nő), csuklás-rántások, nyomva tartós erőmérő zöld „édes” sávval.
- Szabályos darts-pontozás (szimpla/dupla/tripla, bika 25/50; kocsmai, szélesebb dupla/tripla gyűrű), „SZÁZNYOLCVAN!”.
- Italválasztás körönként: fröccs / sör / pálinka (szorzó vs. részegség), kávé játékonként egyszer.
  Az értékek szimulációval hangolva (`tools/balance.mjs`).
- Kocsmai események: csapos sapkája (büntetőfeles), cica (elugrik, nem sérül), üvegtörés, agancs-bónusz, megálló óra, pult, fal.
- Pityu bácsi beszólásai, dupla látás és ringó kép részegen, rangok a játék végén.
- Szintetizált Web Audio hangok és mulatós háttérzene, megjegyzett némítás.
- Online top-10 ranglista (Express API, validálás, rate limit), PostgreSQL saját táblával (`darts_scores`,
  `SCORES_TABLE`), memória-fallback. Közös Kománovics-adatbázisra tervezve.
- Unit/API tesztek (`npm test`), headless Chrome smoke teszt (`npm run smoke`), Render Blueprint.
- Teljes magyar dokumentáció.
