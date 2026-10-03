# Ütemterv – KOMÁNOVICS Darts

## Következő lépések (prioritás szerint)
1. **Közös adatbázis bekötése:** ha a felhasználó jóváhagy egy közös Postgrest (vagy felszabadul az
   ingyenes hely), `DATABASE_URL` beállítása a `komanovics-darts` és a `komanovics` szolgáltatáson,
   majd `/healthz` → `storage: postgres`, `table: darts_scores` ellenőrzése.
2. **Render GitHub App hozzáférés** a repóhoz (GitHub → Settings → Applications → Render), hogy a push automatikusan deployoljon.
3. **Valódi eszközös teszt** (iOS Safari, Android Chrome): érintéses célzás eltolása (70 px) kényelmes-e,
   hang feloldása, 60 FPS. Ha az eltolás zavaró: `TOUCH_OFFSET` a `public/js/input.js`-ben.
4. **301 mód:** `config.js`-ben `MODE`, `game.js`-ben visszaszámlálás, „bust” szabály (0 alá vagy 1-re
   menve a kör érvénytelen), dupla kiszálló opcionális; külön toplista-tábla (`darts301_scores`) vagy `mode` oszlop.
5. **Napi kihívás:** dátumból seedelt véletlen (csuklás-időzítés, beszólások) és külön napi toplista.
6. **Szerveroldali újrajátszás-ellenőrzés:** a kliens a dobások listáját (célpont, erő, idő) küldi, a szerver újraszámolja a pontot (KI-2 enyhítése).
7. **Asztali elrendezés:** széles képernyőn a pult/Kománovics oldalra kerülhet, nagyobb táblával (KI-6).
