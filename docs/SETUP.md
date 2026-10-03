# Telepítés és futtatás – KOMÁNOVICS Darts

## Követelmények
- Node.js **20** (`.nvmrc`), npm 9+
- Opcionális: PostgreSQL 13+ (helyben vagy Render), Google Chrome / Chromium a smoke teszthez

## Helyi futtatás
```bash
git clone https://github.com/zsirafmix/komanovics-darts.git
cd komanovics-darts
npm install
npm start                      # http://localhost:3000
```
`DATABASE_URL` nélkül a ranglista memóriában van (újraindításkor törlődik) – a log ezt jelzi:
`[store] using memory storage (table darts_scores) (scores are lost on restart!)`.

Fejlesztéshez: `npm run dev` (Node `--watch`, a szerver újraindul fájlmódosításkor; a frontend sima
statikus fájl, elég frissíteni a böngészőt).

## Környezeti változók
Lásd `.env.example`. A szerver **nem** tölti be automatikusan a `.env`-et: `set -a; . ./.env; set +a; npm start`.

| Változó | Alapértelmezés | Leírás |
|---|---|---|
| `PORT` | 3000 | HTTP port (Renderen a platform adja) |
| `DATABASE_URL` | – | Postgres kapcsolati string; üres → memória-fallback |
| `SCORES_TABLE` | `darts_scores` | tábla a (közös) adatbázisban; csak `a-z0-9_` |
| `DATABASE_SSL` | automatikus | `true`/`false`; automatikusan SSL külső `*.render.com` hostnál |
| `SCORE_RATE_LIMIT_PER_MIN` | 5 | beküldés / IP / perc |

### Helyi Postgres (opcionális)
```bash
docker run --rm -d --name kd-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres npm start
# a darts_scores tábla induláskor létrejön; /healthz -> "storage":"postgres","table":"darts_scores"
```

## Tesztek
```bash
npm test          # node:test – validálás, táblanév-biztonság, tábla-pontozás, italok, API (memória store)
npm run smoke     # headless Chrome: teljes 8 körös játék (valódi egér + érintés + hookok), beküldés,
                  # gyorsított szimuláció 3 stratégiával, képernyőképek
CHROME_PATH=/usr/bin/chromium SCREENSHOT_DIR=/tmp/shots npm run smoke
BASE_URL=https://komanovics-darts.onrender.com SUBMIT=0 npm run smoke   # élő oldal, beküldés nélkül
npm run balance   # ital-egyensúly szimuláció (P='{"sor":{"mult":1.4}}' felülírással)
```
A smoke teszt hibával lép ki konzolhiba, oldalhiba, sikertelen kérés vagy sikertelen beküldés esetén.

## Deploy (Render)
A futó szolgáltatás: **`komanovics-darts`** (free, Frankfurt), workspace `tea-dabfoslcqm1c73dfirs0`,
URL: https://komanovics-darts.onrender.com. Service ID: lásd `docs/HANDOFF.md`.

Beállítások (MCP `create_web_service`-szel jött létre, nem Blueprint-szinkronnal; a `render.yaml` ugyanezt írja le):
- runtime `node`, build `npm install`, start `npm start`, branch `main`
- env: `NODE_VERSION=20`, `SCORES_TABLE=darts_scores`, `SCORE_RATE_LIMIT_PER_MIN=5`; `DATABASE_URL` nincs beállítva

**Fontos:** a GitHub push NEM indít automatikus deployt (a Render GitHub App-nak nincs hozzáférése a
repóhoz). Push után: Render Dashboard → Manual Deploy, vagy MCP `trigger_deploy` (serviceId).
Megoldás véglegesen: GitHub → Settings → Applications → Render → repo-hozzáférés megadása.

### Közös adatbázis bekötése (később)
1. Legyen egy (akár ingyenes) Render Postgres a workspace-ben – workspace-enként csak egy ingyenes lehet.
2. A `komanovics-darts` és a `komanovics` szolgáltatásnál is állítsd be ugyanazt a `DATABASE_URL`-t
   (Internal Database URL, ha ugyanabban a régióban van; más régióban External URL + SSL automatikus).
3. Deploy után `/healthz` → `"storage":"postgres"`, és a táblák (`darts_scores`, `komanovics_scores`) maguktól létrejönnek.
4. Figyelem: az ingyenes Render Postgres 30 nap után lejár – tartós megoldáshoz fizetős (ehhez a felhasználó jóváhagyása kell).
