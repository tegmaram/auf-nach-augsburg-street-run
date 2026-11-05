# Roadmap — Auf nach Augsburg

**Stand:** 5. November 2026
**Idee:** Ein minimaler Pixel-Stadtlauf durch die echten Straßen von Augsburg.
Drei aktive Etappen, durchgehender Gehweg, Straßenverkehr und ein sanfter
Chiptune-Soundtrack.

## Erledigt

- [x] Durchgehende Straße statt Dachparkour: Fassaden oberhalb der Laufebene,
      Gehweg, Bordstein, Fahrbahn, Gullys und Straßenschilder.
- [x] Drei aktive Etappen: Hauptbahnhof, Königsplatz, Rathaus & Perlachturm.
- [x] Etappen 4–8 bleiben in den Daten erhalten und sind nur ausgeblendet.
- [x] Realistische Kulissen: Bahnhofsfassade, Maximilianstraße, Perlachturm.
- [x] Verkehr fährt durch: Taxi, Bus, Straßenbahn, Van, Limousine, Polizei.
- [x] Fahrräder als neue Hindernisse; Fußgänger, E-Scooter und Tauben bleiben.
- [x] Nur wenige Hindernisse pendeln, die meisten fahren oder laufen durch.
- [x] Münzen statt Zirbelnüssen.
- [x] Acht Chiptune-Tracks, weichere Filter, weniger Spitzen, dynamische
      Intensität, Hall, Echo und Kompressor.
- [x] Größere Buttons im Hauptmenü.
- [x] Fassaden-Cache, gecachte Gradients und gedrosselte HUD-Updates.
- [x] Statische Prüfung und Headless-Smoke-Test.

## Offen

- [ ] Die drei aktiven Etappen manuell auf Schwierigkeit und Spaß testen.
- [ ] Verkehrsdichte und Fahrradtempo feinjustieren.
- [ ] Touch-Steuerung auf einem echten Gerät testen.

## Prüfen

```powershell
python tools/check_project.py
python tools/smoke_test.py
```
