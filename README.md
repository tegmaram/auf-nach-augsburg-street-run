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

Die Straße hat in **jeder** Etappe drei durchgehende Spuren, und sie wechseln
mit der Etappe automatisch mit: **BÜRGERSTEIG**, **STRASSE 1** und
**STRASSE 2**. Auf dem Gehweg laufen Passanten, Radler und Tauben, auf den
beiden Fahrspuren fahren Autos, Busse und Straßenbahnen — Straße 1 in
Laufrichtung, Straße 2 als Gegenverkehr. Ein Tipp auf `S` (oder `↓`) wechselt
die Spur, im Dauerlauf entscheidet der Junge selbst.

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
| `S` / `↓` | Spur wechseln (Gehweg → Straße 1 → Straße 2) |
| Klick oder Tap ins Spiel | Dauerlauf starten |
| `M` | Stadtplan öffnen |
| `P` / `Esc` | Pause |

Auf Touch-Geräten erscheinen zusätzliche Lauf-, Spur- und Sprungbuttons.

## Drei aktive Straßenzüge (recherchierte Kulisse)

Jede Etappe zeigt reale Augsburger Bauwerke entlang ihrer Route — als ferne
Skyline und als Sehenswürdigkeit mit Namenstafel direkt am Straßenrand:

1. **Hauptbahnhof** (870 m, Bahnhofstraße): Empfangsgebäude von **1845**
   (Eduard Rüber, ältestes noch betriebenes Großstadtbahnhofsgebäude
   Deutschlands), die Prachtstraße **Bahnhofstraße** (1869 angelegt), die
   **Große Synagoge** an der Halderstraße (1913–17, Jugendstil mit Kuppel) und
   der **Königsplatz** mit dem Warte-Pavillon „Pilz“ (Otto Holzer, 1913/14) und
   dem **Thormann-Brunnen** von 1880.
2. **Königsplatz → Maximilianstraße** (1.020 m): die seit 1869 so benannte
   Platzanlage, das **Schaezlerpalais** (Rokoko, 1765), der **Merkurbrunnen**
   (1596–99) und der **Herkulesbrunnen** (1602).
3. **Rathaus & Perlachturm** (1.700 m, Rathausplatz): das **Rathaus** von Elias
   Holl (1615–20), der **Perlachturm** (70,4 m), der **Augustusbrunnen** (1594)
   und der **Elias-Holl-Obelisk** von 1968. (Der Obelisk steht am Rathausplatz,
   nicht auf dem Königsplatz.)

Die drei Etappen schalten sich nacheinander frei. Danach folgt der
**Endlos-Modus**. Jede Etappe hat eine Zielzeit und drei Sterne: Zielzeit,
alle Münzen, keine Treffer. Bestzeiten, Sterne und Fortschritt bleiben lokal
im Browser.

Die Etappen 4–8 (Dom, Fuggerei, Lechkanäle, Zeughaus, Sheridan-Park) sind
weiterhin vollständig in `levels.js`/`levels.json` enthalten, aber in der
Auswahl ausgeblendet. Sie lassen sich später mit
`AUGSBURG_ACTIVE_LEVEL_COUNT` in `js/runner/street.js` wieder aktivieren.

## Was drin ist

- Durchgehende Straße statt Dachparkour: **drei Spuren** (Gehweg, Straße 1,
  Straße 2) mit Bordsteinkante, Mittelstreifen, Richtungspfeilen, Gullydeckeln,
  Laternen, Ampeln, Straßenschildern, Wartehäuschen und Zebrastreifen über
  beide Fahrbahnen
- sechs Fahrzeugtypen im Verkehr: Taxi, Bus, Straßenbahn, Van, Limousine und
  Polizei. Sie fahren durch, statt hin und her zu pendeln — und nur auf den
  beiden Fahrspuren; wer dort läuft, wird angefahren und zurück auf den
  Gehweg gesetzt
- acht vorbereitete Straßenszenen mit eigener Skyline, eigenem Belag, eigener
  Wetterstimmung und eigener Musik — aktiv sind die ersten drei
- Fahrräder, Fußgänger, E-Scooter-Kids und Tauben als Hindernisse; die meisten
  laufen oder fahren einfach durch, nur wenige pendeln
- Münzen auf allen drei Spuren (ein paar nur mit Spurwechsel erreichbar),
  Etappensterne, Bestzeiten und Endlos-Rekord
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
