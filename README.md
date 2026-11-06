# Auf nach Augsburg — Street Run

Ein pixeliger Browser-Stadtlauf **durch die echten Straßen von Augsburg**.
Vom Hauptbahnhof über Königsplatz, Rathaus, Dom und Fuggerei bis zu den
Lechkanälen, dem Zeughaus und dem Sheridan-Park.

Die Etappen und Karten werden aus echten OpenStreetMap-Gebäuden und
OSRM-Fußrouten gebaut. Die Runner-Version (`index.html`) braucht keine
Musikdateien, keinen Google-Maps-Schlüssel und kein Backend — der
Chiptune-Soundtrack und alle Soundeffekte werden komplett im Browser
synthetisiert. Jede Etappe hat eine eigene Straßenszene, eigene Farben, eigene
Musik und eigenen Verkehr.

Die Straße ist bewusst schlicht: ein **Gehweg**, eine breite **Asphaltstraße**
mit gestrichelter Mittellinie und ein paar Autos. Dahinter steht eine flache
Häuserzeile, alle Häuser nebeneinander auf einer Standlinie. Keine Gleise,
keine Marktstände, keine gestaffelte Skyline.

**Der Junge bleibt auf dem Gehweg.** Die Autos fahren als ruhige Kulisse
durch. Es gibt keinen automatischen Spurwechsel und keine Spurtaste. Mit
**S/↓** duckt sich der Junge am Boden unter hohen Hindernissen durch. Der
Spieler entscheidet über Timing, Sprung und Tempo.

![Etappe 1 mit schlichter Straße, flacher Häuserzeile und minimalem Charakter](aufnachaugsburg/assets/gameplay.jpg)

![Etappenauswahl mit pixelierter OpenStreetMap-Karte von Augsburg](aufnachaugsburg/assets/screenshot.jpg)

## Spielen

Direkt im Browser: **<https://tegmaram.github.io/auf-nach-augsburg-street-run/>**
(ausgeliefert über GitHub Pages, Workflow `.github/workflows/pages.yml`).

## Lokal starten

Im Ordner `aufnachaugsburg`:

```powershell
python -m http.server 8090 --bind 127.0.0.1
```

Danach <http://localhost:8090/> öffnen. Alternativ `start.bat` im
Projektordner doppelklicken: der Server startet dann auf allen
Netzwerkadressen und der Browser öffnet sich automatisch.

## Steuerung

| Eingabe | Aktion |
| --- | --- |
| `A` / `D` oder `←` / `→` | Laufen |
| `W` / `Leertaste` / `↑` | Springen |
| `Shift` | Rennen |
| Klick oder Tap ins Spiel | Dauerlauf starten |
| `M` | Stadtplan öffnen |
| `P` / `Esc` | Pause |

Auf Touch-Geräten erscheinen zusätzliche Lauf- und Sprungbuttons. Der Junge
läuft fest auf dem Gehweg; die Autos bleiben Kulisse.

## Drei aktive Etappen (recherchierte Routen)

Die Etappen folgen echten Augsburger Routen: Hauptbahnhof → Bahnhofstraße →
Königsplatz, Königsplatz → Maximilianstraße → Rathausplatz und Rathausplatz
mit Rathaus und Perlachturm. Leveldaten und Karten stammen aus
OpenStreetMap/OSRM. Im Spiel selbst ist die Kulisse bewusst schlicht: eine
flache Häuserzeile statt Sehenswürdigkeiten.

Die drei Etappen schalten sich nacheinander frei. Danach folgt der
**Endlos-Modus**. Jede Etappe hat eine Zielzeit und drei Sterne: Zielzeit,
alle Münzen, keine Treffer. Bestzeiten, Sterne und Fortschritt bleiben lokal
im Browser.

Die Etappen 4–8 (Dom, Fuggerei, Lechkanäle, Zeughaus, Sheridan-Park) sind
weiterhin vollständig in `levels.js`/`levels.json` enthalten, aber in der
Auswahl ausgeblendet. Sie lassen sich später mit
`AUGSBURG_ACTIVE_LEVEL_COUNT` in `js/runner/street.js` wieder aktivieren.

## Was drin ist

- **Einfache Straße**: ein Gehweg, eine breite Asphaltstraße mit gestrichelter
  Mittellinie und ein paar Autos. Keine Gleise, Ampeln, Marktstände oder
  Straßenmöbel; der Junge bleibt auf dem Gehweg
- **Ruhige Häuserzeile**: flache Häuser im Vordergrund, dahinter nur wenige
  hohe Häuser und zwei sanfte Bergrücken – eine Stadtkulisse ohne Überladung
- **Wenige Autos als Kulisse**: Straßenbahnen und Gleisanlagen wurden entfernt
- **Tag-Nacht-Zyklus**: Sonne und Mond ziehen über den Himmel, Sterne kommen
  heraus, der Himmel wechselt von Tag über Abendrot zu Nacht. Bei Dunkelheit
  leuchten die Fenster der Häuserzeile und die Fahrzeuglichter
- **Minimaler Charakter**: schlichtes Aussehen mit Shirt, Hose und Schuhen;
  keine Accessoires, nur einfache Idle- und Laufanimationen
- **Fassaden ohne Schilder**: An den Hauswänden hängen keine Schilder oder
  Plaketten; nur am Etappenanfang steht ein einziges Straßenschild
- **Ducken**: mit **S/↓** wird der Junge am Boden kleiner. Tief fliegende
  Tauben kommen auf Kopfhöhe: Wer steht, wird getroffen; wer sich duckt,
  kommt durch. Auf Touch-Geräten gibt es einen eigenen DUCKEN-Button.
- **Ein Herz**: Ein Treffer beendet den Lauf. Der Junge wirbelt in einer
  kurzen Todesanimation durch die Luft und das Herz leert sich. Mit
  Checkpoint geht es am letzten Zwischenziel weiter, ohne Checkpoint startet
  die Etappe komplett von vorn (Zeit, Münzen und Fortschritt werden
  zurückgesetzt)
- acht Etappen mit eigener Himmelsstimmung, eigenem Straßenbelag und eigener
  Musik — aktiv sind die ersten drei
- Fahrräder, Fußgänger, E-Scooter-Kids und Tauben als Hindernisse; die meisten
  laufen oder fahren einfach durch, nur wenige pendeln
- Münzen auf dem Gehweg, Etappensterne, Bestzeiten und Endlos-Rekord
- sanfterer Chiptune-Soundtrack mit acht Tracks, dynamischer Intensität, Hall,
  Echo, Kompressor und Live-Synthese ohne Musikdateien
- HUD, Live-Minimap, große Karte, Pause-, Sieg- und Hilfedialoge
- **Schlichte Kulisse**: keine Marktstände, Cafétische oder Sehenswürdigkeiten
  im Vordergrund; die Häuserzeile bleibt ruhig und übersichtlich
- **Kompaktes In-Game-HUD**: Münzen links, Meter bis zum Ziel in der Mitte,
  Pause/Menü rechts; auf Touch-Geräten sitzt eine große Steuerung
  (← ↓ → und JUMP) unter dem Spiel
- **Bildschirmanpassung für jedes Gerät**: die Bühne passt sich an Fenster,
  Hoch- und Querformat, Tablets und Vollbild an; die Leinwand skaliert in
  ganzen Vielfachen der Gerätepixel (bis 3×) und bleibt dadurch scharf
- responsives Layout, Touch-Steuerung, Tastaturfokus und
  `prefers-reduced-motion`

## Projektstruktur

```text
aufnachaugsburg/
  index.html                  Runner-Version
  classic.html                ältere Version auf der Mario-Engine
  css/runner.css              UI, Etappenauswahl, HUD, Dialoge
  js/runner/audio.js          Chiptune-Soundtrack und Soundeffekte
  js/runner/game.js           Canvas-Runner: Spuren, Verkehr, Physik
  js/runner/street.js         baut die drei Spuren und verteilt die Münzen
  js/runner/browser.js        Etappenauswahl
  js/runner/store.js          Freischaltung, Bestzeiten, localStorage
  js/runner/data/levels.js    generierte Etappendaten
  assets/maps/*.png           pixelierte OpenStreetMap-Karten
  sprites/*.png               Spieler, Autos, Wappen
  tools/build_world.py        OSM/OSRM-Abruf und Level-Generator
  tools/check_project.py      statische Projektprüfung
  tools/smoke_test.py         Headless-Abnahmetest
```

## Tests

```powershell
cd aufnachaugsburg
python tools/check_project.py
python tools/smoke_test.py
```

## Herkunft und Lizenzen

- Engine-Grundlage: [reruns/mario](https://github.com/reruns/mario) von
  Garrett Johnson, MIT-Lizenz (Code).
- Die Mario-Sprites und -Sounds in `classic.html` (`sprites/`, `tiles*`,
  `sounds/*.wav`) sind Nintendo-IP; die MIT-Lizenz des Codes macht die
  enthaltenen Grafiken und Sounds **nicht** zu freiem Material. Für eine
  Veröffentlichung muss der Klassiker-Modus entfernt oder mit eigenem Material
  neu bestückt werden — die Runner-Version (`index.html`) ist davon
  unabhängig, sie zeichnet alles selbst.
- Gebäude, Straßen und Grünflächen: © OpenStreetMap-Mitwirkende, Daten unter
  der [Open Database License](https://www.openstreetmap.org/copyright).
- Fußrouten: [OSRM](http://project-osrm.org/) auf Basis von
  OpenStreetMap-Daten.
- Stadtwappen Augsburg: amtliches Werk / gemeinfrei, Quelle
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:DEU_Augsburg_stylized_COA.svg).
- Nicht-kommerzielles Fan-Projekt ohne Verbindung zu Nintendo, OpenStreetMap,
  OSRM, Google oder der Stadt Augsburg.
