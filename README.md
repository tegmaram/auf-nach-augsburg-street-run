# Auf nach Augsburg — Street Run

Ein pixeliger Browser-Stadtlauf **durch die echten Straßen von Augsburg**.
Vom Hauptbahnhof über Königsplatz, Rathaus, Dom und Fuggerei bis zu den
Lechkanälen, dem Zeughaus und dem Sheridan-Park.

Die Etappen und Karten werden aus echten OpenStreetMap-Gebäuden und
OSRM-Fußrouten gebaut. Es gibt keine Musikdateien, keinen Google-Maps-Schlüssel
und kein Backend — der Chiptune-Soundtrack und alle NES-Soundeffekte werden
komplett im Browser synthetisiert. Jede Etappe hat eine eigene Straßenszene,
eigene Farben, eigene Musik und eigenen Verkehr.

![Etappenauswahl mit pixelierter OpenStreetMap-Karte von Augsburg](aufnachaugsburg/assets/screenshot.jpg)

## Starten

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
| `S` / `↓` | Schneller fallen |
| Klick oder Tap ins Spiel | Dauerlauf starten |
| `M` | Stadtplan öffnen |
| `P` / `Esc` | Pause |

Auf Touch-Geräten erscheinen zusätzliche Lauf-, Renn- und Sprungbuttons.

## Drei aktive Straßenzüge

1. Hauptbahnhof — Bahnhofsfassade, Taxis, Busse und Gleise. Nur Fahrräder,
   E-Scooter und Fußgänger als Hindernisse.
2. Königsplatz — Boulevard, Obelisk, Straßenbahn und Tauben.
3. Rathaus & Perlachturm — Altstadtgassen, mehr Verkehr und dichtere
   Hindernisse.

Die drei Etappen schalten sich nacheinander frei. Danach folgt der
**Endlos-Modus**. Jede Etappe hat eine Zielzeit und drei Sterne: Zielzeit,
alle Münzen, keine Treffer. Bestzeiten, Sterne und Fortschritt bleiben lokal
im Browser.

Die Etappen 4–8 (Dom, Fuggerei, Lechkanäle, Zeughaus, Sheridan-Park) sind
weiterhin vollständig in `levels.js`/`levels.json` enthalten, aber in der
Auswahl ausgeblendet. Sie lassen sich später mit
`AUGSBURG_ACTIVE_LEVEL_COUNT` in `js/runner/street.js` wieder aktivieren.

## Was drin ist

- Durchgehende Straße statt Dachparkour: Häuserfassaden, Bürgersteige,
  Fahrbahnmarkierungen, Gullydeckel, Laternen, Ampeln, Straßenschilder und
  Wartehäuschen
- sechs Fahrzeugtypen im Verkehr: Taxi, Bus, Straßenbahn, Van, Limousine und
  Polizei. Sie fahren durch, statt hin und her zu pendeln
- acht vorbereitete Straßenszenen mit eigener Skyline, eigenem Belag, eigener
  Wetterstimmung und eigener Musik — aktiv sind die ersten drei
- Fahrräder, Fußgänger, E-Scooter-Kids und Tauben als Hindernisse; die meisten
  laufen oder fahren einfach durch, nur wenige pendeln
- Münzen, Etappensterne, Bestzeiten und Endlos-Rekord
- sanfterer Chiptune-Soundtrack mit acht Tracks, dynamischer Intensität, Hall,
  Echo, Kompressor und Live-Synthese ohne Musikdateien
- HUD, Live-Minimap, große Karte, Pause-, Sieg- und Hilfedialoge
- responsives Layout, Touch-Steuerung, Tastaturfokus und
  `prefers-reduced-motion`

## Projektstruktur

```text
aufnachaugsburg/
  index.html                  Runner-Version
  classic.html                ältere Version auf der Mario-Engine
  css/runner.css              UI, Etappenauswahl, HUD, Dialoge
  js/runner/audio.js          Chiptune-Soundtrack und Soundeffekte
  js/runner/game.js           Canvas-Runner: Straßen, Verkehr, Physik
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
- Die Mario-Sprites und -Sounds sind Nintendo-IP; die MIT-Lizenz des Codes
  macht die enthaltenen Grafiken und Sounds nicht zu freiem Material.
- Gebäude, Straßen und Grünflächen: © OpenStreetMap-Mitwirkende, Daten unter
  der [Open Database License](https://www.openstreetmap.org/copyright).
- Fußrouten: [OSRM](http://project-osrm.org/) auf Basis von
  OpenStreetMap-Daten.
- Stadtwappen Augsburg: amtliches Werk / gemeinfrei, Quelle
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:DEU_Augsburg_stylized_COA.svg).
- Nicht-kommerzielles Fan-Projekt ohne Verbindung zu Nintendo, OpenStreetMap,
  OSRM, Google oder der Stadt Augsburg.
