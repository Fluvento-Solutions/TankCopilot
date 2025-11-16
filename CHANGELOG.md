# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [1.2.3] - 2025-11-16

### Behoben
- IndexedDB VersionError behoben: `logs` Store wird jetzt korrekt erstellt
- IndexedDB Version von 2 auf 3 erhöht, um `logs` Store zu initialisieren
- Permissions Policy Verletzung behoben: Keine automatische Geolocation-Anfrage beim App-Start
- Asset-Pfade (Manifest, Icons, Favicon) auf `/TankCopilot/app/` korrigiert
- `checkLocationPermission()` ruft keine Geolocation mehr auf (nur Permissions API)

### Geändert
- Berechtigungsprüfung beim App-Start: Nur Status prüfen, keine automatische Anfrage
- Permissions Policy Meta-Tag hinzugefügt für explizite Geolocation-Erlaubnis

## [1.2.1] - 2025-11-15

### Geändert
- Impressum-Informationen in den Einstellungen hinzugefügt
- Link zum vollständigen Impressum auf fluvento.de integriert

## [1.2.0] - 2025-11-14

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

## [1.1.3] - 2025-11-10

### Behoben
- Navigation-Button funktioniert wieder korrekt
- Konsistente Adressformatierung für Tankstellen

## [1.1.2] - 2025-11-05

### Behoben
- Android-Kompatibilität verbessert
- Service Worker Update-Mechanismus optimiert

## [1.1.1] - 2025-11-01

### Behoben
- iOS-Kompatibilität verbessert
- PWA-Installation auf iOS optimiert

## [1.1.0] - 2025-10-25

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

## [1.0.3] - 2025-10-15

### Hinzugefügt
- Statusmeldungen während API-Aufrufen
- Anzeige des aktuellen Standorts in der Tankstellensuche
- Reverse Geocoding für Standortanzeige

### Geändert
- Verbesserte Netzwerkstatus-Erkennung
- UI-Feedback während API-Calls

## [1.0.2] - 2025-10-10

### Behoben
- Service Worker Konfiguration für Subfolder-Deployment
- PWA-Caching-Strategien optimiert
- Cache-Invalidierung bei Updates

## [1.0.1] - 2025-10-05

### Behoben
- Tankerkönig API-Endpunkt korrigiert
- API-Parameter-Namen angepasst (`radius` → `rad`)
- Response-Parsing für Tankerkönig API verbessert
- OpenRouteService Integration vollständig implementiert

## [1.0.0] - 2025-10-01

### Hinzugefügt
- Erste stabile Release-Version
- Vollständige PWA-Funktionalität
- Offline-Unterstützung
- Service Worker mit Workbox
- iOS-spezifische Meta-Tags und Icons

## [0.5.0] - 2025-09-20

### Hinzugefügt
- Station-Caching für reduzierte API-Aufrufe
- 24-Stunden Cache für Tankstellenpositionen
- Dynamische Preis-Updates bei gecachten Stationen

### Geändert
- API-Aufrufe optimiert durch intelligentes Caching
- Reduzierte Ladezeiten bei wiederholten Suchen

## [0.4.0] - 2025-09-15

### Hinzugefügt
- Reverse Geocoding-Endpoint (`api/reverse-geocode.php`)
- Geocoding-Endpoint (`api/geocode.php`)
- Adresssuche für manuelle Standorteingabe
- Integration von Nominatim (OpenStreetMap)

### Geändert
- Manuelle Standorteingabe unterstützt jetzt Adresssuche
- Verbesserte Benutzerfreundlichkeit bei Standorteingabe

## [0.3.0] - 2025-09-10

### Hinzugefügt
- PWA-Manifest (`manifest.webmanifest`)
- Service Worker für Offline-Funktionalität
- App-Installation auf iOS und Android
- Caching-Strategien für Assets und API-Calls

### Geändert
- Build-Prozess für PWA optimiert
- Vite PWA Plugin integriert

## [0.2.0] - 2025-09-05

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

## [0.1.0] - 2025-09-01

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

[1.2.3]: https://github.com/fluvento/tankcopilot/compare/v1.2.1...v1.2.3
[1.2.1]: https://github.com/fluvento/tankcopilot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/fluvento/tankcopilot/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/fluvento/tankcopilot/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/fluvento/tankcopilot/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/fluvento/tankcopilot/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/fluvento/tankcopilot/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/fluvento/tankcopilot/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/fluvento/tankcopilot/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/fluvento/tankcopilot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fluvento/tankcopilot/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/fluvento/tankcopilot/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fluvento/tankcopilot/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fluvento/tankcopilot/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/fluvento/tankcopilot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fluvento/tankcopilot/releases/tag/v0.1.0

