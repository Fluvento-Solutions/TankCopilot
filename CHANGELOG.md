# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

**Entwicklungszeitraum**: 14. November 2025 (Freitag, 17:00-22:00 Uhr) bis 17. November 2025 (Montag, 11:30 Uhr)

## [1.4.1] - 2025-11-17 15:35

### Geändert
- Version 1.4.0: Nebenversion Update
- Version 1.3.2: Patch Update
- Version 1.3.1: GPS-Tracking optimiert, Live-Updates, Dezimaltrennzeichen-Normalisierung
- Initial commit: TankCopilot v1.2.3 - PWA für Tankbuch & Verbrauchsplaner


## [1.4.0] - 2025-11-17 13:21

### Hinzugefügt
- Version Bump Script (`scripts/version-bump.js`) für automatisierte Versionsverwaltung
- Automatische CHANGELOG-Generierung aus Git-Commits
- Versionsanzeige in den Einstellungen

### Geändert
- Titlebar auf 100vw Breite gesetzt (margin: 0)
- Doppelte Überschriften in allen Views entfernt (View-Namen nur noch in Titlebar)
- Empty States in allen Views vereinheitlicht mit view-spezifischen Beschreibungen
- Button "Fahrzeug hinzufügen" in allen Empty States mit konsistentem Styling
- Header-Button in VehiclesView nur sichtbar wenn bereits Fahrzeuge vorhanden sind

## [1.3.2] - 2025-11-17 12:53

### Geändert
- Titlebar: Margin auf 0 gesetzt, Padding bleibt unverändert
- Empty States für "Fahrten" und "Fahrzeuge" mit Beschreibungen ergänzt
- Alle Empty States haben jetzt die gleiche Struktur und view-spezifische Beschreibungen


## [1.3.1] - 2025-11-17 11:30

### Geändert
- GPS-Tracking optimiert: Nur Positionen mit ≤10m Genauigkeit werden verwendet, Tracking alle 60 Sekunden (statt kontinuierlich)
- Live-Aktualisierung der Dauer (HH:MM:SS) und Strecke bei laufender Fahrt, wenn View sichtbar ist
- Dezimaltrennzeichen-Normalisierung: Komma und Punkt werden in allen Formularen akzeptiert (intern zu Punkt konvertiert)
- `formatDuration()` gibt jetzt immer HH:MM:SS Format zurück (auch bei 0 Stunden: "00:05:23")
- `VehicleForm.vue`: Geschätzter Verbrauch akzeptiert jetzt Komma und Punkt als Dezimaltrennzeichen
- `RefuelForm.vue`: Liter und Gesamtpreis akzeptieren jetzt Komma und Punkt als Dezimaltrennzeichen
- `TripForm.vue`: Strecke akzeptiert jetzt Komma und Punkt als Dezimaltrennzeichen

### Behoben
- Geschwindigkeits-Tracking funktioniert korrekt (Durchschnitts- und Maximalgeschwindigkeit werden berechnet und gespeichert)
- Live-Updates werden nur ausgeführt, wenn die View sichtbar ist (Performance-Optimierung)
- Timer-Berechnung berücksichtigt Pausenzeit korrekt (`pausedDurationSeconds`)

## [1.3.0] - 2025-11-17 11:00

### Hinzugefügt
- Neues View "Fahrten" (`TripsView.vue`) mit vollständiger GPS-Tracking-Funktionalität
- Fahrten können erstellt, bearbeitet und gelöscht werden
- GPS-Tracking mit automatischer Strecken- und Dauerberechnung (Haversine-Formel)
- Start/Stop/Pause/Resume-Funktionalität für Fahrten
- Geschwindigkeits-Tracking: Durchschnittsgeschwindigkeit (gleitender Durchschnitt) und Maximalgeschwindigkeit
- Route-Tracking: GPS-Punkte werden als Array gespeichert (lat, lng, accuracy, speed, heading, timestamp)
- Hinweis-Dialog vor Tracking-Start mit detaillierter Information über Tracking-Parameter (10m Genauigkeit, 60s Intervall, lokale Speicherung)
- Automatische Berechtigungsanfrage für Geolocation vor Tracking-Start
- `tripService.js` für GPS-Tracking, Timer-Verwaltung und Pausenzeit-Berechnung
  - `startTrip()`, `stopTrip()`, `pauseTrip()`, `resumeTrip()`
  - `getActiveTrip()`, `loadActiveTrip()`
  - `formatDuration()`, `formatDistance()`
- `TripList.vue` Komponente für Fahrten-Liste mit Status-Badges und Filterung
- `TripForm.vue` Komponente für Erstellen/Bearbeiten von Fahrten
- `trips` Store in IndexedDB (Version 4) mit Indizes für vehicleId, startDate, endDate, status
- Storage Service erweitert: `loadTrips()`, `getTripsByVehicleId()`, `getTripById()`, `upsertTrip()`, `deleteTrip()`
- Utility-Funktionen für Dezimaltrennzeichen-Normalisierung (`numberUtils.js`): `parseDecimal()`, `normalizeDecimalInput()`, `formatDecimal()`
- Tab "Fahrten" in BottomNavBar mit Navigation-Icon (`PhNavigationArrow`)
- Anzeige der Durchschnitts- und Maximalgeschwindigkeit in Fahrten-Liste und aktiver Fahrt
- Live-Anzeige der Dauer und Strecke bei aktiver Fahrt

### Geändert
- IndexedDB Version von 3 auf 4 erhöht (für trips Store)
- Router erweitert: Route `/trips` hinzugefügt
- App-Start lädt automatisch aktive Fahrten und setzt Tracking fort (auch nach App-Neustart)
- `logService.js`: DB_VERSION auf 4 erhöht (muss mit storageService.js übereinstimmen)
- `App.vue`: Lädt aktive Fahrten beim Start und setzt GPS-Tracking fort

## [1.2.3] - 2025-11-16 22:00

### Behoben
- IndexedDB VersionError behoben: `logs` Store wird jetzt korrekt erstellt
- IndexedDB Version von 2 auf 3 erhöht, um `logs` Store zu initialisieren
- Permissions Policy Verletzung behoben: Keine automatische Geolocation-Anfrage beim App-Start
- Asset-Pfade (Manifest, Icons, Favicon) auf `/TankCopilot/app/` korrigiert
- `checkLocationPermission()` ruft keine Geolocation mehr auf (nur Permissions API)
- API-Endpunkt-Pfade korrigiert (API-Ordner zurück ins Root verschoben)

### Geändert
- Berechtigungsprüfung beim App-Start: Nur Status prüfen, keine automatische Anfrage
- Permissions Policy Meta-Tag hinzugefügt für explizite Geolocation-Erlaubnis
- Code auf GitHub hochgeladen

## [1.2.2] - 2025-11-16 14:00

### Behoben
- IndexedDB VersionError behoben: `logs` Store wird jetzt korrekt erstellt
- Permissions Policy Verletzung behoben: Keine automatische Geolocation-Anfrage beim App-Start
- Asset-Pfade (Manifest, Icons, Favicon) auf `/TankCopilot/app/` korrigiert

## [1.2.1] - 2025-11-16 09:00

### Geändert
- Impressum-Informationen in den Einstellungen hinzugefügt
- Link zum vollständigen Impressum auf fluvento.de integriert

## [1.2.0] - 2025-11-15 17:00

### Hinzugefügt
- Berechtigungsverwaltung für Standort und Benachrichtigungen
- Automatische Berechtigungsprüfung beim App-Start
- Berechtigungsverwaltung in den Einstellungen mit Statusanzeige
- Plattform-spezifische Anleitungen für iOS und Android
- Genauere Standorterfassung für Hausnummern (Genauigkeitsschwelle: 50m)
- Reverse Geocoding gibt jetzt vollständige Adressen inklusive Hausnummer zurück
- `permissionService.js` für zentrale Berechtigungsverwaltung

### Geändert
- Geolocation-Genauigkeit von 500m auf 50m verbessert
- Timeout für GPS-Erfassung von 45s auf 60s erhöht
- Nominatim Reverse Geocoding gibt jetzt Hausnummern zurück
- Adressformat: "Straße Hausnummer, PLZ, Stadt"

## [1.1.3] - 2025-11-15 14:00

### Behoben
- Navigation-Button funktioniert wieder korrekt
- Konsistente Adressformatierung für Tankstellen

## [1.1.2] - 2025-11-15 12:00

### Behoben
- Android-Kompatibilität verbessert
- Service Worker Update-Mechanismus optimiert
- PWA-Subfolder-Konfiguration (`/TankCopilot/app/`) implementiert

## [1.1.1] - 2025-11-15 10:00

### Behoben
- iOS-Kompatibilität verbessert
- PWA-Installation auf iOS optimiert
- Service Worker Scope und Manifest-Pfade angepasst

## [1.1.0] - 2025-11-15 09:00

### Hinzugefügt
- Umfassendes Error-Handling-System (`errorHandler.php`)
- Strukturiertes Logging in `logs/api-errors.log`
- HTTP Request Helper mit cURL-Fallback (`httpRequest.php`)
- Station-Caching-System (`stationCache.php`)
- Hardcoded Fallback-Daten für Geisenhausen (30km Radius)
- Geocoding-Endpoint (`api/geocode.php`)
- Verbesserte Reverse Geocoding-Integration
- Odometer-Feld beim Erstellen/Bearbeiten von Fahrzeugen
- Geschätzter Verbrauch (`estimatedConsumptionLPer100km`) für neue Fahrzeuge
- Konsistente Fehlerbehandlung in allen API-Endpunkten
- Validierungsfunktionen für API-Parameter

### Geändert
- Alle API-Endpunkte nutzen jetzt `httpRequest.php` (cURL-Fallback)
- Verbesserte Fehlerbehandlung in PHP mit globalen Error/Exception-Handlern
- Konsistente JSON-Fehlerantworten
- Konsumberechnung priorisiert: `avgConsumptionLPer100km` → `estimatedConsumptionLPer100km` → 7.5 L/100km Fallback
- Adressformatierung: Erster Buchstabe groß, Rest unverändert

### Entfernt
- Clever-Tanken Scraper (rechtliche Bedenken)
- Redundante Service Worker-Dateien

### Behoben
- `allow_url_fopen` Problem durch cURL-Fallback gelöst
- `haversineDistance` Funktions-Redeklaration behoben
- OpenRouteService API-Integration korrigiert
- IndexedDB Schema-Updates funktionieren korrekt

## [1.0.3] - 2025-11-14 22:00

### Hinzugefügt
- Statusmeldungen während API-Aufrufen
- Anzeige des aktuellen Standorts in der Tankstellensuche
- Reverse Geocoding für Standortanzeige
- Marketing/Sales-Website (`offer/index.html`) mit WCAG AA Compliance

### Geändert
- Verbesserte Netzwerkstatus-Erkennung
- UI-Feedback während API-Calls
- CHANGELOG.md erstellt mit vollständiger Versionshistorie

## [1.0.2] - 2025-11-14 21:00

### Behoben
- Service Worker Konfiguration für Subfolder-Deployment
- PWA-Caching-Strategien optimiert
- Cache-Invalidierung bei Updates
- PWA-Pfade auf `/TankCopilot/app/` angepasst

## [1.0.1] - 2025-11-14 20:00

### Behoben
- Tankerkönig API-Endpunkt korrigiert
- API-Parameter-Namen angepasst (`radius` → `rad`)
- Response-Parsing für Tankerkönig API verbessert
- OpenRouteService Integration vollständig implementiert
- CORS-Header korrekt konfiguriert

## [1.0.0] - 2025-11-14 19:00

### Hinzugefügt
- Erste stabile Release-Version
- Vollständige PWA-Funktionalität
- Offline-Unterstützung
- Service Worker mit Workbox
- iOS-spezifische Meta-Tags und Icons
- Android-Kompatibilität

## [0.5.0] - 2025-11-14 18:30

### Hinzugefügt
- Station-Caching für reduzierte API-Aufrufe
- 24-Stunden Cache für Tankstellenpositionen
- Dynamische Preis-Updates bei gecachten Stationen

### Geändert
- API-Aufrufe optimiert durch intelligentes Caching
- Reduzierte Ladezeiten bei wiederholten Suchen

## [0.4.0] - 2025-11-14 18:00

### Hinzugefügt
- Reverse Geocoding-Endpoint (`api/reverse-geocode.php`)
- Geocoding-Endpoint (`api/geocode.php`)
- Adresssuche für manuelle Standorteingabe
- Integration von Nominatim (OpenStreetMap)

### Geändert
- Manuelle Standorteingabe unterstützt jetzt Adresssuche
- Verbesserte Benutzerfreundlichkeit bei Standorteingabe

## [0.3.0] - 2025-11-14 17:30

### Hinzugefügt
- PWA-Manifest (`manifest.webmanifest`)
- Service Worker für Offline-Funktionalität
- App-Installation auf iOS und Android
- Caching-Strategien für Assets und API-Calls

### Geändert
- Build-Prozess für PWA optimiert
- Vite PWA Plugin integriert

## [0.2.0] - 2025-11-14 17:00

### Hinzugefügt
- Tankerkönig API-Integration für Spritpreise
- OpenRouteService API-Integration für Routenberechnung
- Umgebungsvariablen-Support (`.env` Datei)
- API-Konfiguration (`api/config.php`)
- Haversine-Distanzberechnung als Fallback
- Mock-Daten für Entwicklung und Offline-Modus

### Geändert
- API-Endpunkte für externe Services
- Verbesserte Fehlerbehandlung bei API-Aufrufen

## [0.1.0] - 2025-11-14 17:00

### Hinzugefügt
- Initiale Projektstruktur
- Vue.js 3 mit Composition API
- Vue Router für Navigation
- IndexedDB für lokale Datenspeicherung
- Grundlegende UI-Komponenten (Glass-UI Design)
- Dashboard-Ansicht
- Fahrzeugverwaltung (Erstellen, Bearbeiten, Löschen)
- Tankbuch (Tankvorgänge erfassen und verwalten)
- Tankstellensuche mit Standortbestimmung
- Einstellungen (Währung, Distanz-Einheit, Navigations-App)
- Datenexport (JSON, DSGVO-konform)
- Datenlöschung (DSGVO Art. 17)
- Konsumberechnung basierend auf Tankvorgängen
- Kostenberechnung für Tankstellenfahrten
- Navigation-Integration (Apple Maps, Google Maps, Waze, OsmAnd)
- QR-Code-Generierung für App-Sharing
- Logging-System für Debugging
- Responsive Design für Mobile und Desktop

### Technische Details
- Vite als Build-Tool
- Phosphor Icons für UI-Icons
- Glass-UI Design-System
- WCAG AA konforme Farben
- Barrierefreie Navigation

---

## Legende

- **Hinzugefügt**: Neue Features
- **Geändert**: Änderungen an bestehenden Features
- **Veraltet**: Features, die bald entfernt werden
- **Entfernt**: Entfernte Features
- **Behoben**: Bug-Fixes
- **Sicherheit**: Sicherheitsrelevante Änderungen

[1.4.1]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.2.1...v1.2.3
[1.2.1]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Fluvento-Solutions/TankCopilot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Fluvento-Solutions/TankCopilot/releases/tag/v0.1.0

