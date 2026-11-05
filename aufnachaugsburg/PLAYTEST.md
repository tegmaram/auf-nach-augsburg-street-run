# Playtest-Checkliste

Kurz und praktisch. Für jede neue Etappe und vor jedem Release einmal
durchgehen.

## Automatischer Vorlauf

Vor dem manuellen Playtest diese beiden Prüfungen laufen lassen:

```powershell
python tools/check_project.py
python tools/smoke_test.py
```

`check_project.py` prüft Leveldaten, Sprunglücken, Karten, Sprites, lokale
Verweise, DOM-IDs und JavaScript-Syntax. `smoke_test.py` spielt alle acht
Etappen im Dauerlauf, testet Pause, Karte, Endlos-Modus, Fortschritt, Reset,
v1-Migration, `classic.html` und die mobile Ansicht. Beide müssen grün sein,
bevor der manuelle Teil beginnt.

## Vor dem Start

- [ ] `python -m http.server 8090` starten und `http://localhost:8090/` öffnen.
- [ ] Zusätzlich `index.html` direkt per Doppelklick öffnen (ohne Server).
- [ ] Browser-Konsole leeren und auf Fehler achten.
- [ ] Fortschritt im Browser einmal löschen und neu beginnen.

## Etappen

- [ ] Etappe im manuellen Lauf komplett schaffen.
- [ ] Etappe mit Dauerlauf komplett schaffen (Klick/Tap ins Spielfeld).
- [ ] Dauerlauf an der weitesten Lücke und an jedem Anstieg prüfen.
- [ ] Dauerlauf nach Pause, Karte und Fensterwechsel fortsetzen.
- [ ] `A`/`D` bricht den Dauerlauf zuverlässig ab.
- [ ] Nach einem Sturz: zwei Wiederholungen an derselben Stelle, danach
  stoppt der Dauerlauf.
- [ ] Alle Zwischenziele werden gesetzt; nach einer Flagge landet der Respawn
  exakt am Flaggen-Checkpoint, nicht am letzten beliebigen Dachrand.
- [ ] Zielzeit, Sterne und Bestzeit werden korrekt angezeigt.
- [ ] Alle Zirbelnüsse sind erreichbar, auch die versteckten.
- [ ] Keine unlösbaren Sprünge, keine unfairen Hinderniskombinationen.

## Hindernisse und Optik

- [ ] Fußgänger, E-Scooter-Kids (Helm/Handy) und Tauben sind auf einen Blick
  unterscheidbar.
- [ ] Treffer-Feedback ist lesbar: Rempelei, Scooter-Stoß mit Abheben und
  Funken, Tauben-Schwarm.
- [ ] Scooter-Klingel, Crash und Warnsignal sind hörbar, aber nicht
  aufdringlich.
- [ ] Schritte klingen auf Dach und Straße passend und nerven nicht.
- [ ] Fassaden, Fenster, Türen, Hausnummern und Schilder haben keine
  Pixel-Fehler; Dachziegel, Moos und Fensterreflexe sind lesbar.
- [ ] Stadtwappen-Logo und 512 × 320-Karten bleiben auf kleinen Displays
  scharf.
- [ ] Regen, Abendlicht und Herbstlaub überdecken keine Hindernisse.
- [ ] HUD und Dauerlauf-Indikator bleiben auch auf kleinen Displays lesbar.

## Steuerung und Barrierefreiheit

- [ ] Touch-Steuerung auf einem echten Gerät testen.
- [ ] Nur-Tastatur-Bedienung: Etappenauswahl, Dialoge, Pause und Karte.
- [ ] Fokus bleibt in geöffneten Dialogen und kehrt danach zurück.
- [ ] `prefers-reduced-motion` reduziert Partikel, Shake und Blitz.
- [ ] Sound lässt sich ein- und ausschalten; Einstellung bleibt erhalten.
- [ ] Musik lässt sich getrennt schalten; Einstellung bleibt erhalten.
- [ ] Soundtrack startet erst nach der ersten Eingabe und läuft nicht doppelt.

## Fortschritt und Sonderfälle

- [ ] Freischaltung, Bestzeiten und Sterne überleben ein Neuladen.
- [ ] Altes v1-Speicherformat wird ohne Datenverlust übernommen.
- [ ] Endlos-Modus startet nach den fünf Hauptetappen.
- [ ] Endlos-Rekord wird gespeichert und angezeigt.
- [ ] Endlos-HUD zeigt die laufende Gesamtzeit.
- [ ] `classic.html` (ältere Augsburg-Version) bleibt spielbar.
- [ ] Keine hängenden Tasten und kein doppelter Dauerlauf.
