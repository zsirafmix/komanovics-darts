# Hibaelhárítás – KOMÁNOVICS Darts

## A ranglista üres lett / eltűnt egy pontszám
Nincs `DATABASE_URL` → memóriabeli tároló, ami minden újraindításkor (deploy, Render free alvás) törlődik.
Ellenőrzés: `curl https://komanovics-darts.onrender.com/healthz` → `"storage":"memory"`. Megoldás: közös
Postgres bekötése (docs/SETUP.md).

## Push után nem frissült az élő oldal
A Render GitHub App nem fér hozzá a repóhoz, így nincs auto-deploy. Indíts kézi deployt (Dashboard vagy
MCP `trigger_deploy`). A statikus fájlok `no-cache` fejlécet kapnak, egy sima frissítés elég.

## Az első betöltés 30–60 mp
Render free szolgáltatás 15 perc tétlenség után elalszik. Ez várható viselkedés.

## `POST /api/scores` → 400 „A pontszám nem hihető ennyi játékidőhöz.”
A hihetőségi szűrő `score ≤ 100 + durationSec × 90`. Kézi `curl` tesztnél adj meg reális `durationSec`-et
(pl. 60). A `level` 1..8 lehet, a `durationSec` kötelező.

## `POST /api/scores` → 429
5 beküldés / perc / IP (`SCORE_RATE_LIMIT_PER_MIN`). Várj a `Retry-After` fejlécben megadott ideig.

## Szerver indításkor: `Invalid SCORES_TABLE name: ...`
A `SCORES_TABLE` csak kisbetűt, számot, aláhúzást tartalmazhat, betűvel/aláhúzással kezdődik, max 63 karakter.

## Nincs hang
A böngészők csak felhasználói interakció után engedik az AudioContextet – az első kattintás/érintés
(„Dobás!”) indítja. Ellenőrizd a némítást (M, vagy a hangszóró ikon; `localStorage.kd_muted`).
iOS-en a néma kapcsoló is elnémíthatja a Web Audiót.

## A smoke teszt nem indul
`CHROME_PATH` mutasson egy Chrome/Chromium binárisra (alapértelmezés `/usr/bin/google-chrome`).
A `puppeteer-core` nem tölt le böngészőt.

## Headless képernyőképeken négyzetek az ikonok helyén
Az emojikat a headless Chrome betűtípus nélkül négyzetként rajzolja – ezért a HUD-ban inline SVG ikonok
vannak, emoji sehol.

## Sikertelen próbálkozások (tanulságok)
- **Elavult célkereszt a hook-dobásoknál:** a smoke teszt első változata csak a `game.aim`-ot állította,
  de a dobás a képkockánként számolt `game.cross`-t használja, így minden hook-dobás az előző célpontra ment
  (a „cica” dobás a bikát találta). Javítás: a hook a `cross`-t is beállítja.
- **Banner a tábla közepén:** az eredeti 28%-os magasságú banner eltakarta a célkeresztet és az erőmérőt –
  52%-ra (a tábla alá) került.
- **Ital a képernyőn kívül:** a bal kézben lévő pohár x-koordinátája nagy fejméretnél negatív lett
  (`head.cx − 0,62·headH`) – most legalább 26.
- **Egyensúly első körben:** sör ×1,25 / +15 és pálinka ×1,5 / +25 mellett a „mindig fröccs” stratégia
  minden célzási pontosságnál nyert (nem volt valódi kockázat/jutalom). Szimuláció alapján sör ×1,35 / +12,
  pálinka ×1,7 / +20 lett.
- **Szimuláció végtelen ciklusa:** ha a véletlen elengedési küszöb 1 fölé került, az erő sosem érte el →
  a küszöb max 0,97.
- **`pkill -f` a fejlesztői gépen:** egy túl általános minta a saját shellt is leölte – PID alapján kell leállítani.
