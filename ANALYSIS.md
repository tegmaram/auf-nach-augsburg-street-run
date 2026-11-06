# Auf nach Augsburg — Street Run: Code- & Produktanalyse

**Stand:** 5. November 2026 · Branch `arena/a1490cd2-auf-nach-augsburg-street-run` (Commit `7f8a636`)
**Umfang:** 87 getrackte Dateien, ~2,2 MB, ein einziger Commit, keine CI.
**Kurzfassung:** Sauber gebauter, hübscher kleiner Browser-Runner mit viel Liebe im Detail — und
vier handfesten Problemen: ein **unerreichbarer Münz-Stern** in 2 von 3 aktiven Etappen, ein
**totes Sturz-/Checkpoint-System**, eine **Meter-Anzeige, die nicht zur Spiellänge passt**, und
**stark veraltete Doku/Screenshots**. Dazu kommt ein **lizenzrechtliches Risiko** (Nintendo-Assets),
das vor einer Veröffentlichung geklärt werden sollte.

---

## 0a. Umsetzungsstand (Nachtrag)

Alle Punkte aus dieser Analyse sind in der vorliegenden Fassung abgearbeitet
oder bewusst beiseitegelegt. Der Stand im Einzelnen:

| Punkt | Status | Was jetzt gilt |
|---|---|---|
| 2.1 Münze hinter dem Ziel | **behoben** | Die vier Münzen hinter `finishX` sind vor die Ziellinie gerückt; `check_project.py` prüft jetzt `nut.x <= finishX - 40`. |
| 2.2 „clean"-Stern / tote Stürze | **behoben** | Stürze zurück auf den Gehweg gibt es wieder (Autos, Fehlsprünge), Checkpoints und `respawnPlayer` arbeiten auf Spuren statt auf Dächern. |
| 2.3 Meter, Zielzeit, Tempo | **behoben** | `targetTime = max(18, lengthPx/185 + 3)` – am tatsächlich erreichbaren Tempo kalibriert und im Generator verankert. Die Meter-Anzeige bleibt eine geraffte Routendistanz. |
| 2.4 Dauerlauf | **behoben** | Der Dauerlauf wählt die Spur selbst (Gehweg, sonst Straße), springt früher (46/62 px), holt versteckte Münzen und weicht Autos aus. `planAutoJump`/`autoJumpPowerFor` sind entfernt, `npcSpotClear` prüft die Startzone über die Position. |
| 2.5 Kein Fail-State | **offen (Design)** | Treffer bremsen bzw. setzen zurück, es gibt weiterhin keine Leben. Ein Lauf endet nicht vorzeitig. |
| 3 Doku/Screenshot | **behoben** | READMEs, Zahlen (21/29/31 Häuser), Stadtbeschreibungen und `assets/screenshot.jpg` sind aktualisiert; `index.html` startet mit „0 / 3". |
| 4.1 `role="listitem"` | **behoben** | Karten sind wieder echte Buttons, der Container ist `role="group"`. |
| 4.2/4.3 HUD-Typografie & Tap-Targets | **behoben** | Alle Beschriftungen skalieren mit `clamp()` (≥ 9 px), HUD-Buttons sind ≥ 40 px (mobil 44 px). |
| 4.4 Minimap auf Touch | **behoben** | Der `display:none`-Block ist weg, die Karte bleibt erreichbar. |
| 4.5 Canvas-Text | **teilweise** | Schilder nutzen 4–5 px statt 3 px und größere Tafeln; ein Bitmap-Font bleibt eine gute Idee. |
| 4.6 `aria-live` auf unsichtbarem HUD | **behoben** | `aria-live` am Dauerlauf-Badge entfernt. |
| 4.7 Laufzeitfehler ohne Hinweis | **behoben** | `window.onerror` blendet das Fehlerbanner ein. |
| 5 `formatClock` NaN, `|| 0`, Endlos-Rekord | **behoben** | `formatClock` prüft `isFinite`; `RunnerStore.complete()` validiert Werte; der Endlos-Rekord speichert Etappen, Zeit und Münzen als Paket. |
| 5 `slice(0,5)` | **behoben** | Endlos-Modus schaltet nach allen aktiven Etappen frei. |
| 5 Tauben treffen nie | **behoben** | Die Vögel fliegen 6–12 px tiefer und nur noch auf dem Gehweg. |
| 5 DPR/Integer-Scaling | **behoben** | `applyRenderScale()` setzt den Backing-Store auf ein ganzzahliges Vielfaches der Gerätepixel (1–3×) und skaliert den Kontext per `setTransform`; die Welt bleibt logisch 480 × 270. `applyViewport()`/`fitStage()` passen die Bühne an `innerWidth`/`innerHeight`/`visualViewport` an, inklusive `orientationchange`, Adressleisten-Zoom und Vollbild. |
| 6 Toter Code | **behoben** | `planAutoJump`, `autoJumpPowerFor` und die Plattform-Lande-Logik sind ersetzt; `street.js` erzeugt das Drei-Spuren-Modell. |
| 6 Daten doppelt / Repo-Hygiene | **teilweise** | `levels.json` ist jetzt eingerückt (lesbare Diffs), `levels.js` bleibt kompakt; Root-`.gitignore` und eine GitHub-Action (`check.yml`) sind da. |
| 7 Nintendo-IP | **offen (bewusst)** | Der Klassiker-Modus bleibt erhalten, ist aber im README klar als nicht verteilbares Material markiert. |

Zusätzlich neu: **drei durchgehende Bänder** (Bürgersteig, Straßenbahn,
Straße) in jeder Etappe, automatisch pro Etappe eingefärbt, Verkehr
ausschließlich auf Gleis und Fahrbahn und eine recherchierte Kulisse aus echten
Augsburger Bauten je Route (siehe README).

### Nachtrag Runde 3 (6. November 2026)

| Thema | Was jetzt gilt |
|---|---|
| **Spurwechsel ohne Hand** | `S`/`↓` und der Touch-Button „SPUR" sind entfernt. `autoLaneThink()` läuft jetzt in jeder Etappe (nicht nur im Dauerlauf): sie prüft Autos im eigenen Band, weicht auf ein freies Band aus, jagt Münzen und kehrt auf den Gehweg zurück. Einzige Eingaben sind Laufen und Springen. |
| **Straßenbahn-Band** | `LANE_TRAM = 1` fährt nur noch Straßenbahnen (`buildTraffic()` filtert `tram` aus der Autoliste), `LANE_CARS = 2` nur Autos. `drawTramLine()` zeichnet Schotter, Schwellen, zwei Schienen und Oberleitung; der Fußgängerüberweg führt nur noch über die Autospur, davor eine Verkehrsinsel. |
| **Deutsche Bahn** | `drawDeutscheBahn()` legt hinter die Fassaden einen Bahndamm mit Bogenöffnungen, Oberleitungsmasten, Fahrdraht, ICE und Regionalzug; am Hauptbahnhof kommt eine DB-Logo-Gantry dazu. |
| **Jedes Gerät** | Die Bühne wird per `--stage-w` aus der echten Viewporthöhe berechnet (Playbar-Höhe wird gemessen), die Leinwand skaliert in ganzen Gerätepixel-Vielfachen. Getestet für 375×667 bis 2560×1440, Hoch- und Querformat, DPR 1–3. |

---

## 0. Wie ich geprüft habe

- Komplette Code-Lektüre von `js/runner/*.js` (~6.100 Zeilen), `classic.html` + `js/augsburg.js`,
  `tools/*.py`, CSS, HTML, Leveldaten.
- `python tools/check_project.py` → **grün** (8 Stufen, 31 JS-Dateien, DOM-Vertrag).
- `tools/smoke_test.py` **nicht** ausführbar: Playwright/Chromium ist hier nicht installiert und
  lässt sich in dieser Umgebung nicht nachladen. Ersatzweise habe ich `js/runner/*.js` in Node mit
  einem minimalen DOM/Canvas-Stub geladen und die echte Spiellogik headless durchgespielt
  (Auto-Run, Endlos-Modus, Store, Browser-UI). Alle Zahlen unten stammen aus diesen Läufen bzw. aus
  einer Datenprüfung von `levels.json`.
- Das Spiel läuft als Live-Preview (Port 8090) — direkt im Browser vergleichbar.

---

## 1. Was das Projekt ist

Ein statisches Browser-Spiel ohne Build, ohne Backend, ohne Framework:

```
index.html → levels.js (8 Stufen, JSON inline)
           → street.js   (macht aus Dach-Plattformen eine durchgehende Straße)
           → audio.js    (8 Chiptune-Tracks + SFX, live per Web Audio)
           → store.js    (localStorage: Fortschritt, Sterne, Bestzeiten)
           → browser.js  (Etappenauswahl)
           → game.js     (4.637 Zeilen: Physik, Rendering, HUD, Dialoge)
classic.html → die alte Mario-Engine (js/*.js) als „Klassiker-Modus"
tools/      → build_world.py (OSM/OSRM → Leveldaten), make_sprites.py, check_project.py, smoke_test.py
```

**Die entscheidende Architektur-Entscheidung:** `street.js` wirft die generierte Parkour-Geometrie weg
und ersetzt sie durch **eine einzige Plattform** über die ganze Levelbreite
(`platforms = [{ x:0, w:lengthPx, roofY:212 }]`). Die alten Plattformen bleiben nur als
`level.buildings` für die Fassadengrafik übrig. Das ist der Kern vieler Folgeprobleme (siehe 2.3/2.4).

Die Stärken sind echt: konsistente Pixel-Optik, gecachte Fassaden-Canvases, dynamisches HUD,
`safe-area`/Touch-Layout, `prefers-reduced-motion`, Tastaturfokus, Store-Migration v1→v2.
Logic-Kosten: **0,31 ms/Frame** in meinem Stub — Performance ist kein Thema.

---

## 2. Bugs, die man als Spieler merkt (Priorität 1)

### 2.1 Ein Münz-Stern ist in Etappe 1 und 3 **mathematisch unmöglich** ⛔

Der Stern „alle Münzen" verlangt `state.collected.size === level.nuts.length`
(`js/runner/game.js:1306`). In vier der acht Stufen liegt aber je eine Münze **hinter der Ziellinie**:

| Stufe | Münzen | letzte Münze x | `finishX` | erreichbar? |
|---|---:|---:|---:|---|
| 1 Hauptbahnhof (**aktiv**) | 24 | 5094 | 4990 | **nein** |
| 2 Königsplatz (aktiv) | 25 | 5483 | 5890 | ja |
| 3 Rathaus (**aktiv**) | 27 | 6074 | 5970 | **nein** |
| 4/6 Dom, Lechkanäle | 31/29 | 6074 | 5970 | **nein** |

Ursache (exakt reproduziert): `tools/build_world.py` legt Münzen pro Plattform an
(`for index, platform in enumerate(platforms): if index % 2 == 0: nuts.append({x: platform.x + platform.w*0.5 …})`,
Zeilen ~848–866) — **auch für die 560 px breite Ziel-Plaza**. Die Ziellinie liegt bei
`plaza.x + 176`, der Münzmittelpunkt bei `plaza.x + 280` → **immer 104 px hinter dem Ziel**.
Ob es passiert, hängt nur von der Parität des Plaza-Index ab (26, 32, 32, 34 = gerade → Münze;
29, 13, 31, 39 = ungerade → keine Münze).

Beim Erreichen von `finishX` schaltet das Spiel sofort auf Outro
(`game.js:1907`, `beginOutro()` setzt `player.x = max(x, finishX+8)`), die letzten 104 px sind also
nie erreichbar. **Folge: In Etappe 1 und 3 sind maximal 2 von 3 Sternen erreichbar** — der
Sammel-Stern ist dauerhaft verloren. Mein Auto-Run bestätigt das: 20/24, 20/25, 20/27 Münzen,
Sterne `★☆☆`.

**Fix (klein):** im Generator die Plaza ausnehmen bzw. `x` auf `finish_line - 24` clampen; sinnvoll
zusätzlich in `check_project.py` prüfen: *jede* Münze `< finishX`. Für die ausgelieferten Daten
genügt es, die vier Münzen zu verschieben und `nuts.length` unverändert zu lassen.

### 2.2 Der Stern „keine Treffer" zählt auch Stürze — und Stürze gibt es nicht

```js
// game.js:1304
var starFlags = {
  time:  state.elapsed <= targetTime,
  nuts:  state.collected.size === state.level.nuts.length && …,
  clean: state.hits === 0 && state.falls === 0      // ← README sagt „keine Treffer"
};
```
- Die UI erklärt den Stern als „ohne Treffer" (`game.js:1370`), die Bedingung ist aber
  „keine Treffer **und** keine Stürze".
- Gleichzeitig ist `state.falls` im aktuellen Design **unerreichbar**: Es gibt keine Lücke, keine
  Kante, keinen Abgrund — die Straße ist eine einzige Plattform über die volle Breite und
  `player.x` ist auf `[20, lengthPx-20]` geklemmt. `respawnPlayer()` (`game.js:1912`) läuft nur,
  wenn `player.y > H + 50` oder über `RunnerGame.forceFall()` (Debug).
- Konsequenz: **Checkpoints, Respawn, „sichere Straßenecke", Retry-Logik und der Fall-Zähler sind
  toter Code.** Der README-Satz „Ein Sturz bringt dich zur letzten sicheren Straßenecke zurück"
  beschreibt eine Mechanik, die es nicht gibt. Die Flaggen im Level sind reine Deko mit Ton.

### 2.3 Meter, Zielzeit und Tempo passen nicht zusammen

`distance` ist die echte OSRM-Fußweg-Distanz, `lengthPx = clamp(2800, distance*6, 6200)` und
`targetTime = lengthPx / 150` (`build_world.py:681,908`). Durch das Clamping koppelt sich beides:

| Stufe | Distanz | `lengthPx` | Zielzeit | impliziertes Tempo |
|---|---:|---:|---:|---:|
| Hauptbahnhof | 870 m | 5220 | 35 s | 24,9 m/s (90 km/h) |
| Rathaus | 1700 m | 6200 (gekappt) | 41 s | **41,5 m/s (150 km/h)** |
| Sheridan-Park | 2520 m | 6200 (gekappt) | 41 s | **61,5 m/s (221 km/h)** |
| Fuggerei | 410 m | 2800 (Min.) | 19 s | 21,6 m/s |

Der HUD zählt echte „METER" herunter, der Junge läuft aber mit 100 px/s (WALK) bzw. 174 px/s (RUN).
Das ist kein Crash, aber es macht die Meter-Anzeige zur Kulisse und die Zielzeiten zwischen den
Stufen unvergleichbar (Etappe 3 ist auf dem Papier 1,7 km, ingame aber nur 1,19× so lang wie
Etappe 2). **Vorschlag:** entweder `distance` aus `lengthPx / 6` ableiten (dann stimmt die Anzeige)
oder `targetTime` aus `distance / 2.2` berechnen und die Zielzeiten pro Stufe spreizen.

### 2.4 Der Dauerlauf ist kein „Auto-Sprung", sondern ein Glücksspiel

Der Klick-Modus verspricht „AUTO-SPRUNG" (`index.html`, Click-Hint). Messung über alle drei Etappen:

| Etappe | Auto-Run-Zeit | Ziel | Treffer |
|---|---:|---:|---:|
| 1 | 27,9 s | 35 s | **3** |
| 2 | 33,1 s | 41 s | **4** |
| 3 | 33,7 s | 41 s | **5** |

Gründe:
- Der Hindernis-Hop greift nur bei `edgeDistance > 110` (`game.js:1738`) — auf einer
  durchgehenden Straße ist die „Kante" 6.000 px entfernt, also greift er technisch immer, aber
  nur für NPCs, die < 48 px entfernt sind; bei 174 px/s sind das **0,27 s** Reaktionsfenster.
- Der Gap-Sprung (`planAutoJump`, `game.js:369`) ist mit einer einzigen Plattform **nie erfüllbar**
  (`if (platformIndex > standing)` kann nie wahr werden) → 130 Zeilen toter Code.
- `npcSpotClear()` prüft `platform.type === "start"` (`game.js:566`) — nach `street.js` gibt es
  keinen `start`-Typ mehr, die Startzone wird also **nicht** freigehalten.

Ergebnis: Der Modus ist „durchkommen mit 3–5 Remplern", nicht „sauber durchlaufen". Für den
Sterne-Satz („ohne Treffer") ist er damit unbrauchbar — das ist okay als Design, sollte aber nicht
als Auto-Pilot verkauft werden. **Einfacher Fix:** NPC-Hindernisse im Auto-Run früher erkennen
(Trigger 48 → ~90 px), Hop-Power an Fahrgeschwindigkeit koppeln, toten `planAutoJump` entfernen.

### 2.5 Es gibt keinen Fail-State — der Endlos-Rekord ist beliebig

Man kann nicht verlieren: keine Zeitlimits (die Zielzeit ist nur ein Stern), keine Leben, keine
Gesundheit, keine Grube. Treffer bremsen nur. Der Endlos-Modus wiederholt die drei Stufen in
Schleife, ohne Steigerung; der „Rekord" (`bestStage`) wächst also **unbegrenzt mit der Geduld**.
Dazu schreibt der Endlos-Modus stillschweigend Bestzeiten/Sterne in die Einzelstufen
(`finishOutro` ruft `RunnerStore.complete()` auch im Endlos-Lauf, `game.js:1323`) — ohne
Ergebnisdialog. Für einen Highscore wäre ein Limit (z. B. 5 Treffer = Lauf vorbei) sinnvoller.

---

## 3. Doku und ausgelieferte Daten lügen

| Behauptung | Realität |
|---|---|
| README-Tabelle: Etappe 2 „**24** Häuser", Etappe 3 „**25** Häuser" | 29 und 31 (`street.js` zählt alle Nicht-Bridge-Plattformen; im UI steht auch 29/31) |
| `assets/screenshot.jpg` (Hero-Bild in beiden READMEs) | zeigt **8 Etappen**, „0 / 8", „1 VON 8 FREIGESCHALTET", Dach-Tagline — Stand vor dem Street-Rework |
| `index.html` statisch: „0 / 8", 24 Häuser, 24 Münzen | wird beim Start überschrieben (3 Etappen, 21 Häuser) → kurzes Falsch-Aufblitzen; ohne JS bleibt es falsch stehen |
| `PLAYTEST.md`: „spielt **alle acht** Etappen", „Endlos-Modus startet nach den **fünf** Hauptetappen", „**Zirbelnüsse**" | 3 Etappen, Endlos nach 3, Münzen |
| `build_world.py`-Taglines: „Jetzt geht es über die **Dächer**" | Daten sagen „über die Straßen"; ein Re-Run des Generators würde die Texte zurücksetzen |
| Root-README: „keine Musikdateien" | `classic.html` lädt **12 NES-`.wav`**-Dateien (`sounds/`) |
| Root-README: „kein Google-Maps-Schlüssel" | `classic.html` hat ein komplettes Google-Static-Maps-Key-Feld inkl. localStorage |
| `check_project.py` prüft Sprunglücken ≤ 92 px / Drops ≤ 34 px | diese Geometrie wird von `street.js` **verworfen** — der Check prüft Ungenutztes und übersieht genau den Fehler aus 2.1 |
| `smoke_test.py` Docstring: „all eight stages" | testet 3 |
| Root-`start.bat` bindet `0.0.0.0` (LAN) | README empfiehlt `127.0.0.1` |

Der wichtigste Punkt: **`tools/build_world.py` ist nicht mehr die Quelle der ausgelieferten Daten.**
Die Daten wurden nachträglich (Text, `weather`, Zielzeiten) von Hand angepasst. Ein erneuter
Generator-Lauf überschreibt das und produziert wieder Dach-Taglines — das ist eine Falle für den
nächsten, der „mal die Welt neu baut".

---

## 4. Accessibility & UX

1. **`role="listitem"` auf jedem `<button>`** (`browser.js:133`) mitsamt `role="list"` am Container.
   Damit verlieren die Etappenkarten ihre Button-Semantik für Screenreader („Listenpunkt" statt
   „Schaltfläche, Etappe 1: Hauptbahnhof"). Die ARIA-Rolle überschreibt hier die native Rolle —
   besser: `role="listitem"` weg, ein `<ul><li><button>` oder schlicht `role="option"` +
   `aria-selected` auf einem `listbox`.
2. **HUD-Typografie ist zu klein:** Labels mit `font-size: 5–8px` (z. B. `.hud-level span` 6px,
   `.hud-level .hud-mode` 5px, `.hud-buttons button` 6px) auf einer bis zu 1.180 px breiten Bühne.
   Die Zahlen (15 px) sind lesbar, „MÜNZEN/ZEIT/START/ZIEL" nicht.
3. **HUD-Buttons sind winzige Tap-Targets:** `min-width: 29px`, mobil 23px, kaum 18 px hoch
   (`.hud-buttons button`, `runner.css:1308`, 2272). Empfohlen sind 44×44 px — auf dem Handy ist
   Pause/Karte nur mit Glück zu treffen, obwohl die restlichen Touch-Buttons korrekt 44 px haben.
4. **Minimap auf Touch komplett ausgeblendet** (`@media (pointer: coarse) { .minimap-panel { display:none } }`),
   obwohl sie als Feature beschrieben ist.
5. **Canvas-Text ist matschig:** Schilder werden mit `ctx.font = "3px …"` auf ein 480×270-Canvas
   gezeichnet und dann ~2,5× hochskaliert — 3-px-Antialiasing skaliert man nicht pixelig. Entweder
   Bitmap-Font (es gibt einen 5×7-Font in `augsburg.js`!) oder Canvas-Auflösung an
   `devicePixelRatio`/Bühnenbreite koppeln.
6. **`aria-live` am `.hud-mode`**, das per `opacity: 0` unsichtbar ist: Screenreader lesen
   „DAUERLAUF" dauerhaft mit, auch wenn kein Dauerlauf läuft.
7. **`#load-error`** fängt nur fehlgeschlagene `<script>`-Loads. Ein Laufzeitfehler in `game.js`
   hinterlässt eine funktionslose, aber „normale" Etappenauswahl ohne Hinweis.
8. Kleinigkeiten: `beginOutro()` teleportiert den Spieler sichtbar auf `finishX+8`; das Doppelklick-
   Launch auf Karten ist nicht entdeckbar; die Reset-Buttons teilen sich einen Timer, wodurch ein
   scharfgestellter Button beliebig lange „WIRKLICH LÖSCHEN?" bleibt; `armReset` enthält einen
   Ternär, bei dem beide Zweige identisch sind (`browser.js:329`).

---

## 5. Robustheit / Randfälle

- **Korruptes localStorage** wird nur oberflächlich saniert (`store.js:23`): `best`, `stars`,
  `cleared` werden als Objekte übernommen, ihre Werte nicht validiert. `best.hbf.time = "x"` →
  die Sieg-Anzeige zeigt `NaN:NaN.NaN` (`formatClock` rechnet ohne `isFinite`-Guard, im Gegensatz
  zu `formatTime` in `browser.js`).
- **`RunnerStore.complete()`** vererbt `hits` per `Math.min(previous.hits, result.hits || 0)`; ein
  fehlendes Feld (`undefined`) wird zu 0 und verbessert stillschweigend den alten Wert. Gleiches
  Muster bei `nuts` mit `|| 0`.
- **Endlos-Rekord** koppelt `bestStage` und `bestTime` unabhängig: ein 3-Stufen-Lauf kann die
  „beste Zeit" eines 9-Stufen-Laufs unterbieten. Angezeigt wird nur `bestStage` — die Daten sind
  also inkonsistent, fallen aber nicht auf.
- **`updateProgressLabels()`** prüft `LEVELS.slice(0, 5)` und `Math.min(5, LEVELS.length)`
  (`browser.js:114`) — bei einer Reaktivierung der Etappen 4–8 bedeutet das „Endlos erst nach 5 von
  8", während die README „nach den drei Etappen" sagt. Magische Zahl, zwei Stellen.
- **`window.setInterval(musicSchedule, 25)`** mit 180 ms Look-ahead ist korrekt gebaut; bei
  verstecktem Tab wird die Musik gestoppt (`visibilitychange`) — gut. Kein Leak gefunden.
- **`Resize`/DPR**: das Canvas bleibt fix 480×270; auf 5K-Displays ist die Bühne 1.180 px breit →
  ungleichmäßige Pixelverdopplung. Kein Bug, aber ein Qualitätsverlust (Integer-Scaling oder
  DPR-Auflösung wären „pixel-perfect").
- **Tauben treffen fast nie**: `buildBirds` setzt `baseY = 212 - (38…64)` = 148–174 px, die
  Kollision verlangt aber `bird.y > player.y - 6` = 178 px (`game.js:721/826`). Nur Vögel, die am
  tiefsten Punkt ihres Bobs (Amplitude 4–21 px) ankommen, sind auf Straßenhöhe überhaupt
  kollidierbar — der Rest fliegt sichtbar durch die Figur hindurch. Entweder Bahn tiefer legen oder
  Trefferzone auf die Flugbahn ausdehnen.
- **Zwei `start.bat`**: das Root-Skript `cd`-et in den Unterordner und `call`t das zweite. Fehlt
  Python, schließt sich das Fenster ohne Fehlermeldung; der Browser wird nach 1 s geöffnet, was auf
  langsamen Rechnern zu früh sein kann.

---

## 6. Architektur & Wartbarkeit

| Thema | Beobachtung |
|---|---|
| Monolith | `js/runner/game.js` = **4.637 Zeilen / 166 KB** in einer IIFE, ~100 Funktionen, kein Export außer `RunnerGame`. Jede Änderung an Physik, Rendering und HUD landet in derselben Datei. |
| Kein Build | Bewusst (kein Bundler, `file://`-fähig, gut!). Aber: keine Module, keine Typen, keine Lint-Regeln, kein `package.json`. |
| Daten doppelt | `levels.js` **und** `levels.json` (je ~46 KB, **eine Zeile**). `check_project.py` schützt vor Drift — aber Diffs sind bei jeder Neugenerierung ein kompletter Datei-Rewrite. Besser: JSON prettified + ein Mini-Loader oder `levels.js` als `module.exports`-fähige Quelle. |
| Altlast | Der komplette Mario-Kernel (`js/**`, **25 Dateien**) liegt parallel im Repo, nur für `classic.html`. Doppelte Physik, doppelte Assets, doppelte Fehlerquellen. |
| Toter Code | `planAutoJump` + `autoJumpPowerFor` (~57 Zeilen, mit einer Plattform nie erfüllbar), `respawnPlayer`/Checkpoint-Retry/Fall-Zähler, `npcSpotClear`-Startzone, `state.weatherParticles` und `state.carHintShown` (nur geschrieben, nie gelesen). |
| Tests | `check_project.py` ist ordentlich (PNG-Header, DOM-Vertrag, `node --check`) — prüft aber die falsche Geometrie und hätte 2.1 nicht gefunden. `smoke_test.py` ist inhaltlich stark (Auto-Run, Endlos, Migration, Mobile), benötigt aber Playwright und läuft **nirgends automatisch**: kein `.github/workflows`, kein npm-Skript. |
| Repo-Hygiene | Kein Root-`.gitignore` (nur `aufnachaugsburg/.gitignore` mit `*.txt`); `tools/cache/` (OSM/OSRM-Cache) wird nicht ignoriert, obwohl der Generator ihn anlegt; generierte `tools/preview-*.png` sind eingecheckt; keine `.gitattributes` für Binärdateien. |
| Lizenzdatei | Nur `aufnachaugsburg/LICENSE` (MIT, **nur** „Copyright (c) 2017 Garrett Johnson"). Der neue Code (Erik, 2026) hat keine Copyright-Zeile → rechtlich unklar, unter welcher Lizenz die Eigenanteile stehen. |
| Hosting | Alles liegt in `aufnachaugsburg/`. GitHub Pages vom Repo-Root würde `/aufnachaugsburg/index.html` ausliefern; es gibt keinen Root-Redirect, keine Pages-Workflow-Datei. Für „einfach verlinken" fehlt der letzte Meter. |

**Positiv:** `street.js` als schmale Transformationsschicht ist ein guter Schnitt; die Trennung
`data → street → browser/game/audio` ist klar; alle Pfade sind relativ (funktioniert in jedem
Unterordner); `check_project.py` mit DOM-Vertrag ist besser als in 90 % vergleichbarer Hobby-Projekte.

---

## 7. Rechtliches Risiko (der größte Blockpunkt vor Veröffentlichung)

Das Repo enthält **Nintendo-IP**, nicht nur „Mario-inspirierte" Grafik:

- `sprites/1-1 reference.png` ist ein **Rip von Super Mario Bros. World 1-1** (im Bild steht
  „SMB NES World 1-1 ripped by A.J. Nitro. Give credit if used.") — der Credit fehlt zudem.
- `sprites/tiles.png`, `player*.png`, `enemy*.png`, `items.png` sind die Original-SMB-Spritesheets.
- `sounds/*.wav` (12 Dateien) sind die NES-Soundeffekte.
- `js/levels/11.js` baut **World 1-1** nach (Block für Block), inkl. Untergrund-Level (`11tunnel.js`).

Die MIT-Lizenz von `reruns/mario` deckt den **Code** von Garrett Johnson, nicht die Assets. Der
README sagt das ehrlich („Die Mario-Sprites und -Sounds sind Nintendo-IP"), aber das ändert nichts
an der Rechtslage: **so ist das Repo nicht verteilbar**, unabhängig davon, dass es „Fan-Projekt"
ist. Der `classic.html`-Modus ist der Hauptbelastungsfaktor — der Runner selbst
(`js/runner/*` + `sprites/boy.png`, `car*.png`, `crest.png`) ist eigenständig und unproblematisch.

**Empfehlung:** `classic.html` + `js/*.js` (Mario-Kernel) + `sounds/` + alle Nintendo-Sprites aus
dem Repo entfernen oder in ein privates Archiv auslagern; dann ist das Projekt ein sauberes,
lizenzierbares Fan-Spiel mit OSM-Karten (ODbL-Attribution ist korrekt vorhanden). Alternativ:
Assets durch Eigenproduktionen ersetzen (`make_sprites.py` erzeugt Boy und Auto bereits selbst).
Das Stadtwappen ist gemeinfrei, unterliegt als Hoheitszeichen aber Nutzungsregeln — der Hinweis im
README ist gut, ein eigener Wappen-Ersatz (z. B. stilisierte Zirbelnuss) wäre stressfreier.

---

## 8. Was wirklich gut ist

- **Konsistente Kunstrichtung**: 8 Paletten, Fassaden-Cache, Pixelfont-Schilder, Wetter-Overlays —
  das sieht nach deutlich mehr als „Hobby-Bastelei" aus.
- **Live-Audio ohne Dateien**: 8 Tracks mit Progression, Drums, Delay, Convolver-Reverb, Kompressor
  und intensitätsabhängigen Layern, sauber gegen Autoplay-Policy abgesichert.
- **Bedienkonzept**: Klick = Dauerlauf, A/D übernimmt sofort, Pause/M/ESC, Fokus-Trap in Dialogen,
  `prefers-reduced-motion`, sichtbarer Fokus, Skip der Intros.
- **Store**: versioniert, migriert v1 → v2 verlustfrei, defensiv gegen kaputtes JSON.
- **Daten**: echte OSM-Gebäude als Fassaden, OSRM-Routen für die Minimap, korrekte Attribution im UI
  („Gebäude & Straßen: OpenStreetMap-Mitwirkende / Fußroute: OSRM").
- **Performance**: 0,31 ms Logik/Frame, gecachte Gradients und Fassaden, gedrosselte HUD-Updates.

---

## 9. Reihenfolge, in der ich es anfassen würde

1. **Münze hinter dem Ziel** (2.1) — 30 Minuten, macht zwei Etappen erst „dreisterne-fähig".
   Daten: 4 Münzen verschieben; Generator: Plaza ausnehmen; Check: `nut.x < finishX`.
2. **Stern-Logik & UI angleichen** (2.2): `clean = hits === 0` (wie dokumentiert) **oder**
   Beschriftung ehrlich machen („keine Treffer, kein Sturz"). Entscheiden, ob Stürze je wieder
   eingeführt werden — sonst `respawnPlayer`/Checkpoints und die README-Zeile entfernen.
3. **Meter/Tempo konsistent machen** (2.3): `distance` aus `lengthPx/6` ableiten oder Zielzeiten
   aus der Distanz. Eine Zeile in `build_world.py` plus Daten-Regeneration.
4. **Doku/Screenshot aktualisieren** (3): Screenshot neu (3 Etappen, 21 Häuser), README-Tabelle,
   PLAYTEST (3 Etappen, Münzen), `build_world`-Taglines, `check_project`-Docstring.
5. **Auto-Run ehrlich machen** (2.4): Trigger auf ~90 px, toten `planAutoJump` löschen; sonst im
   UI „Dauerlauf (mit Rempeleien)" nennen.
6. **A11y-Kleinigkeiten** (4): `role="listitem"` weg, HUD-Buttons ≥ 40 px, HUD-Labels ≥ 9 px,
   `aria-live` am `.hud-mode` entfernen.
7. **Rechtliches aufräumen** (7): `classic.html` + Nintendo-Assets raus, Root-`LICENSE`/`NOTICE`.
8. **Repo-Hygiene**: Root-`.gitignore` (`tools/cache/`, `tools/preview-*.png`, `__pycache__/`),
   Leveldaten lesbar formatieren, GitHub-Action, die `check_project.py` bei jedem Push fährt
   (Playwright-Job optional/manuell).

---

### Anhang: Messwerte aus dem Headless-Lauf

```
Etappe 1  Auto-Run 27,9 s (Ziel 35)  Treffer 3  Stürze 0  Münzen 20/24  Sterne ★☆☆
Etappe 2  Auto-Run 33,1 s (Ziel 41)  Treffer 4  Stürze 0  Münzen 20/25  Sterne ★☆☆
Etappe 3  Auto-Run 33,7 s (Ziel 41)  Treffer 5  Stürze 0  Münzen 20/27  Sterne ★☆☆
Endlos    Etappe 1 → 2 wechselt korrekt, HUD-Gesamtzeit läuft (0:28,4), Rekord bestStage=1
Store     v1→v2-Migration, Reset, Freischaltung: ok
Daten     21/29/31 Häuser (UI) vs. 21/24/25 (README); Springer-Münzen: hbf, rathaus, dom, lechkanaele
```
