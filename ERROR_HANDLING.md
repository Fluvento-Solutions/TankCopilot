# Error Handling & Logging - TankCopilot API

## Übersicht

Das Error-Handling-System bietet detaillierte Fehlerbehandlung für Entwicklung und Produktion.

## Features

### 1. **Zentraler Error-Handler** (`api/errorHandler.php`)
- Automatische Entwicklung/Produktion-Erkennung
- Strukturiertes Logging in JSON-Format
- Log-Datei: `logs/api-errors.log`
- Unterschiedliche Detailtiefe für Dev/Prod

### 2. **Strukturierte Fehler-Responses**

Alle API-Endpunkte geben jetzt strukturierte Fehler-Responses zurück:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Ungültige Parameter",
  "timestamp": "2025-11-16T16:00:00+00:00",
  "detail": "Validierungsfehler: Parameter 'lat' ist erforderlich",
  "data": {
    "validation_errors": [
      {
        "param": "lat",
        "code": "MISSING_PARAM",
        "message": "Parameter 'lat' ist erforderlich"
      }
    ]
  },
  "debug": {
    "request_uri": "/api/fuel-prices.php",
    "request_method": "GET",
    "query_params": {...},
    "php_version": "8.1.0"
  }
}
```

### 3. **Fehler-Codes**

- `VALIDATION_ERROR` - Parameter-Validierungsfehler (400)
- `CONFIG_ERROR` - Konfigurationsfehler (500)
- `API_ERROR` - Externe API-Fehler (500)
- `RESPONSE_ERROR` - Fehler beim Erstellen der Antwort (500)
- `UNHANDLED_EXCEPTION` - Unbehandelte Exception (500)

### 4. **Logging-Level**

- **ERROR**: Kritische Fehler (API-Fehler, Exceptions)
- **WARNING**: Warnungen (übersprungene Stationen, leere Responses)
- **INFO**: Informative Meldungen (API-Aufrufe, Stationen gefunden)
- **DEBUG**: Debug-Informationen (nur in Development)

## Log-Datei

Alle Fehler werden in `logs/api-errors.log` gespeichert (JSON-Format, eine Zeile pro Eintrag):

```json
{
  "timestamp": "2025-11-16 16:00:00",
  "level": "ERROR",
  "message": "Tankerkönig API Request fehlgeschlagen",
  "ip": "192.168.1.1",
  "request_uri": "/api/fuel-prices.php?lat=48.4489&lng=12.2564",
  "user_agent": "Mozilla/5.0...",
  "context": {
    "api_url": "https://...",
    "api_key_length": 36,
    "php_config": "allow_url_fopen ist deaktiviert"
  },
  "exception": {
    "message": "API-Anfrage fehlgeschlagen",
    "code": 0,
    "file": "/path/to/file.php",
    "line": 240,
    "trace": "..."
  }
}
```

## Entwicklung vs. Produktion

### Entwicklung
- Detaillierte Fehlermeldungen in JSON-Response (`detail` Feld)
- Debug-Informationen (`debug` Feld)
- Stack-Traces in Logs
- PHP error_log zusätzlich zu Log-Datei

### Produktion
- Nur benutzerfreundliche Fehlermeldungen
- Keine Stack-Traces in Logs
- Keine Debug-Informationen in Responses
- Nur kritische Fehler werden geloggt

## Verwendung

### Parameter-Validierung
```php
$validationRules = [
    'lat' => ['required' => true, 'type' => 'float', 'min' => -90, 'max' => 90],
    'lng' => ['required' => true, 'type' => 'float', 'min' => -180, 'max' => 180]
];

$validationErrors = validateParams($params, $validationRules);
if ($validationErrors !== null) {
    sendErrorResponse('VALIDATION_ERROR', 'Ungültige Parameter', ...);
}
```

### Fehler-Logging
```php
logError('ERROR', 'API Request fehlgeschlagen', [
    'api_url' => $apiUrl,
    'error_code' => $errorCode
], $exception);
```

### Fehler-Response senden
```php
sendErrorResponse(
    'API_ERROR',
    'API-Anfrage fehlgeschlagen',
    'Detaillierte Fehlermeldung (nur in Development)',
    ['additional_data' => 'value'],
    500,
    $exception
);
```

## Log-Datei analysieren

### Mit jq (JSON-Query)
```bash
# Alle Fehler anzeigen
cat logs/api-errors.log | jq 'select(.level == "ERROR")'

# Fehler der letzten Stunde
cat logs/api-errors.log | jq 'select(.timestamp > "'$(date -u -d '1 hour ago' +%Y-%m-%d\ %H:%M:%S)'")'

# Fehler nach Code gruppieren
cat logs/api-errors.log | jq -s 'group_by(.context.error_code) | map({code: .[0].context.error_code, count: length})'
```

### Mit grep
```bash
# Alle API-Fehler
grep "Tankerkönig API" logs/api-errors.log

# Fehler mit Exception
grep '"exception"' logs/api-errors.log
```

## Troubleshooting

### Problem: API funktioniert nicht im Livebetrieb

1. **Prüfe Log-Datei:**
   ```bash
   tail -f logs/api-errors.log
   ```

2. **Häufige Probleme:**
   - `allow_url_fopen ist deaktiviert` → PHP-Konfiguration prüfen
   - `API-Anfrage fehlgeschlagen: HTTP 429` → Rate-Limiting
   - `API-Anfrage fehlgeschlagen: HTTP 401` → API-Key ungültig
   - `Leere Response erhalten` → Server-Problem oder Rate-Limiting

3. **Debug-Modus aktivieren:**
   Setze in `.env`:
   ```
   APP_ENV=development
   ```

### Problem: Validierungsfehler

Die Logs zeigen genau, welcher Parameter fehlt oder ungültig ist:
```json
{
  "validation_errors": [
    {
      "param": "lat",
      "code": "MISSING_PARAM",
      "message": "Parameter 'lat' ist erforderlich"
    }
  ]
}
```

## Best Practices

1. **Immer strukturierte Fehler-Responses verwenden**
   - Nicht einfach `echo json_encode(['error' => '...'])`
   - Verwende `sendErrorResponse()` für konsistente Responses

2. **Kontext hinzufügen**
   - Logge immer relevante Informationen (API-URL, Parameter, etc.)
   - Erleichtert Debugging erheblich

3. **Sensible Daten nicht loggen**
   - API-Keys nur teilweise loggen (erste 10 Zeichen)
   - Keine Passwörter oder persönliche Daten

4. **Log-Rotation**
   - Log-Datei kann groß werden
   - Regelmäßig rotieren oder löschen
   - Automatische Rotation kann mit cronjob eingerichtet werden

---

**Version**: 1.1.0
**Letzte Aktualisierung**: 2025-11-16

