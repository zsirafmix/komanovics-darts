# Ismert hibák és korlátok – KOMÁNOVICS Darts

## KI-1: Nincs adatbázis → a ranglista memóriában van
A Render workspace-ben már létezik egy ingyenes Postgres (`allyoutuber`, lejár 2026-10-29), és
workspace-enként csak egy ingyenes lehet; adatbázis létrehozása a feladat szerint tilos volt. Ezért
`DATABASE_URL` nincs beállítva: a ranglista minden újraindításkor/alváskor törlődik.
**Terv:** egy közös Kománovics-adatbázis (`darts_scores` + `komanovics_scores` táblák), lásd ARCHITECTURE 4. pont.

## KI-2: Kliensoldali pontszámítás
A pontszámot a böngésző számolja; a szerver csak durva hihetőségi szűrést végez (max 5000 pont, ≤ 8 kör,
`score ≤ 100 + durationSec × 90`, rate limit). Elszánt csaló hamis, de hihető pontszámot küldhet.

## KI-3: Render free korlátok
15 perc tétlenség után alvás (első kérés ~30–60 mp), havi ingyenes órakeret.

## KI-4: Nincs automatikus deploy
A Render GitHub App nem fér hozzá a `zsirafmix/komanovics-darts` repóhoz → push után kézi / MCP deploy kell.

## KI-5: Valódi eszközön nem tesztelt
Csak headless Chrome-ban (390×844 mobil emuláció érintéssel, 1366×768 asztali) tesztelve. iOS Safari /
Android Chrome érintés, hang (Web Audio feloldás) és teljesítmény valódi eszközön ellenőrizendő.

## KI-6: Asztali nézet keskeny
Az #app álló arányú oszlop (szélesség ≤ 0,72 × magasság) – asztalon középen „telefon-szerű” sáv,
oldalt üres háttér. Szándékos (egy layout minden eszközre), de széles képernyőn kicsi a tábla.

## KI-7: Egyetlen játékmód
Csak a 8 körös pontgyűjtő mód kész; 301 visszaszámlálós mód nincs (ROADMAP).

## KI-8: Szélesebb dupla/tripla gyűrű
A dupla és tripla gyűrű 13 mm (szabvány: 8 mm) a mobilos játszhatóság miatt – „kocsmai szabály”, nem versenytábla.
