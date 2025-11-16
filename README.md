# TankCopilot

**TankCopilot** ist eine mobile-first Progressive Web App (PWA) für Autofahrer, die ein digitales Tankbuch führt und bei der optimalen Tankstellenwahl hilft.

## Features

- 📝 **Tankbuch**: Erfassung aller Tankvorgänge (nicht nur Volltankungen)
- 📊 **Verbrauchsberechnung**: Realistischer Durchschnittsverbrauch basierend auf allen Tankungen
- 🚗 **Fahrzeugverwaltung**: Mehrere Fahrzeuge mit individuellen Einstellungen
- 📍 **Tankstellensuche**: Findet Tankstellen in der Nähe basierend auf dem aktuellen Standort
- 💰 **Ersparnis-Berechnung**: Zeigt, bei welcher Tankstelle sich das Tanken am meisten lohnt
- 🧭 **Navigation**: Direkter Aufruf der Navigation zur gewählten Tankstelle
- 🔒 **Datenschutz**: Alle Daten werden nur lokal im Browser gespeichert

## Technologie-Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Routing**: Vue Router
- **Storage**: IndexedDB (lokal im Browser)
- **Backend**: PHP 8 (Shared-Hosting-kompatibel)
- **PWA**: Service Worker + Web App Manifest

## Installation

### Voraussetzungen

- Node.js (v16 oder höher)
- npm oder yarn
- PHP 8 (für das Backend)

### Frontend Setup

1. Dependencies installieren:
```bash
npm install
```

2. Entwicklungsserver starten:
```bash
npm run dev
```

Die App ist dann unter `http://localhost:3000` erreichbar.

3. Production Build erstellen:
```bash
npm run build
```

Der Build wird im `dist/` Ordner erstellt.

### Backend Setup

1. Den `api/` Ordner in den Webroot Ihres PHP-Servers kopieren.

2. Stellen Sie sicher, dass PHP 8 installiert ist und die folgenden Extensions aktiviert sind:
   - `json`
   - `mbstring` (optional, für bessere UTF-8 Unterstützung)

3. Die API-Endpoints sind dann unter `https://ihre-domain.de/api/` erreichbar.

**Wichtig**: Aktuell verwenden die PHP-Endpoints Mock-Daten. Für eine Produktionsumgebung sollten echte Spritpreis- und Routing-APIs integriert werden (siehe Hinweise unten).

## Projektstruktur

```
tankcopilot/
├── api/                    # PHP Backend
│   ├── config.php          # Konfiguration (für spätere API-Keys)
│   ├── fuel-prices.php     # Tankstellensuche (aktuell Mock)
│   └── route-distance.php  # Routenberechnung (aktuell Haversine)
├── public/                 # Statische Assets
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   └── icons/              # PWA Icons
├── src/
│   ├── components/         # Vue Komponenten
│   │   ├── BottomNavBar.vue
│   │   ├── VehicleForm.vue
│   │   ├── VehicleList.vue
│   │   ├── RefuelForm.vue
│   │   ├── RefuelList.vue
│   │   └── StationList.vue
│   ├── services/          # Business Logic
│   │   ├── storageService.js      # IndexedDB Wrapper
│   │   ├── consumptionService.js  # Verbrauchsberechnung
│   │   ├── geoService.js          # Geolocation
│   │   └── fuelStationService.js  # Tankstellen-API
│   ├── views/             # Vue Views
│   │   ├── DashboardView.vue
│   │   ├── VehiclesView.vue
│   │   ├── RefuelLogView.vue
│   │   ├── PlanRefuelView.vue
│   │   └── SettingsView.vue
│   ├── router/            # Vue Router
│   │   └── index.js
│   ├── App.vue
│   └── main.js
├── package.json
├── vite.config.js
└── README.md
```

## Verbrauchsberechnung

Die App berechnet den Durchschnittsverbrauch basierend auf **allen** Tankvorgängen, nicht nur Volltankungen:

1. Alle Tankvorgänge werden nach Kilometerstand sortiert
2. Für jedes Segment zwischen zwei Tankungen wird der Verbrauch berechnet
3. Es wird ein Zeitfenster von 60 Tagen verwendet (mindestens 28 Tage)
4. Der Durchschnitt wird km-gewichtet berechnet: `(Σ segmentConsumption * kmDelta) / Σ kmDelta`

## API-Integration (Hinweise)

### Spritpreis-API

Die Datei `api/fuel-prices.php` verwendet aktuell Mock-Daten. Für eine echte Implementierung können folgende APIs verwendet werden:

- **Tankerkönig API**: Kostenlos, deutsche Tankstellen
- **Spritpreis-API**: Verschiedene Anbieter verfügbar
- **Open Data Portale**: Viele Städte bieten offene Daten an

Die Mock-Daten sind so strukturiert, dass sie leicht durch echte API-Calls ersetzt werden können. Siehe Kommentare in `api/fuel-prices.php`.

### Routing-API

Die Datei `api/route-distance.php` verwendet aktuell die Haversine-Formel (Luftlinie). Für echte Fahrdistanzen können folgende APIs verwendet werden:

- **OpenRouteService**: Kostenlos, Open Source
- **OSRM**: Open Source Routing Machine
- **Google Directions API**: Kommerziell, sehr genau
- **Mapbox Directions API**: Kommerziell

Siehe Kommentare in `api/route-distance.php` für Beispiel-Implementierungen.

## Datenschutz

- **Lokale Speicherung**: Alle Fahrzeug- und Tankdaten werden ausschließlich lokal im Browser (IndexedDB) gespeichert
- **Keine Server-Speicherung**: Keine Nutzerdaten werden serverseitig gespeichert
- **Standortdaten**: Der Standort wird nur bei expliziter Tankstellensuche verwendet und nicht gespeichert
- **Kein Tracking**: Die App verwendet keine Tracking-Technologien

## Browser-Unterstützung

- Chrome/Edge (empfohlen)
- Firefox
- Safari (iOS 11.3+)
- Mobile Browser (Android Chrome, iOS Safari)

## Entwicklung

### Code-Qualität

- Vue 3 Composition API
- Modulare Service-Architektur
- Trennung von Präsentation und Logik
- Async/await für asynchrone Vorgänge
- Umfassende Fehlerbehandlung

### PWA Features

- Installierbar auf mobilen Geräten
- Offline-fähig für App-Shell und lokale Daten
- Service Worker für Caching-Strategien
- Web App Manifest für native App-Erfahrung

## Lizenz

Dieses Projekt ist für den privaten Gebrauch frei verwendbar.

## Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im Repository.

---

**TankCopilot** - Tankbuch & Verbrauchsplaner für Autofahrer

