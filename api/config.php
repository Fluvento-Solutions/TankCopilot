<?php
/**
 * Config File für TankCopilot API
 * 
 * API-Keys und Konfigurationen für echte APIs.
 * 
 * API-Keys:
 * - Tankerkönig API: https://creativecommons.tankerkoenig.de/
 *   Registrierung erforderlich, kostenlos, max. 300 Requests/Tag
 * - OpenRouteService: https://openrouteservice.org/
 *   Für Routing (optional)
 */

// .env-Datei laden (wenn vorhanden)
function loadEnvFile($filePath) {
    if (!file_exists($filePath)) {
        return;
    }
    
    if (!is_readable($filePath)) {
        error_log('Warnung: .env-Datei ist nicht lesbar: ' . $filePath);
        return;
    }
    
    try {
        $lines = @file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        if ($lines === false) {
            error_log('Fehler: Konnte .env-Datei nicht lesen: ' . $filePath);
            return;
        }
        
        foreach ($lines as $lineNum => $line) {
            // Entferne Whitespace am Anfang und Ende
            $line = trim($line);
            
            // Überspringe leere Zeilen und Kommentare
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }
            
            // Parse KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                
                // Überspringe Zeilen ohne Key
                if (empty($key)) {
                    continue;
                }
                
                // Entferne Anführungszeichen falls vorhanden
                if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                    (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
                
                // Setze als Umgebungsvariable (nur wenn noch nicht gesetzt)
                // Leere Werte werden auch gesetzt (für explizite Leerung)
                if (!isset($_ENV[$key])) {
                    $_ENV[$key] = $value;
                }
            }
        }
    } catch (Exception $e) {
        error_log('Fehler beim Laden der .env-Datei: ' . $e->getMessage());
        // Weiter ohne .env-Datei
    }
}

// Lade .env-Datei aus dem Projekt-Root (ein Verzeichnis über api/)
$envPath = dirname(__DIR__) . '/.env';
loadEnvFile($envPath);

$config = [
    // Tankerkönig API Key (für echte Spritpreise)
    // Bitte tragen Sie Ihren API-Key in die .env-Datei im Projekt-Root ein
    // Registrierung: https://creativecommons.tankerkoenig.de/
    'fuelPriceApiKey' => isset($_ENV['TANKERKOENIG_API_KEY']) && !empty($_ENV['TANKERKOENIG_API_KEY']) 
        ? $_ENV['TANKERKOENIG_API_KEY'] 
        : '',
    
    // OpenRouteService API Key (optional, für echte Routenberechnung)
    'routingApiKey' => isset($_ENV['OPENROUTESERVICE_API_KEY']) && !empty($_ENV['OPENROUTESERVICE_API_KEY']) 
        ? $_ENV['OPENROUTESERVICE_API_KEY'] 
        : '',
    
    // CORS-Einstellungen
    'cors' => [
        // In Produktion spezifische Domains angeben statt '*'
        'allowed_origins' => isset($_ENV['ALLOWED_ORIGINS']) 
            ? explode(',', $_ENV['ALLOWED_ORIGINS']) 
            : ['*'],
        'allowed_methods' => ['GET', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Accept']
    ],
    
    // API-Endpoints
    'apiEndpoints' => [
        'tankerkoenig' => 'https://creativecommons.tankerkoenig.de/json',
        'openrouteservice' => 'https://api.openrouteservice.org/v2'
    ]
];

// Mock-Modus: Wenn true, werden Mock-Daten verwendet (für Entwicklung)
$config['useMockData'] = empty($config['fuelPriceApiKey']);

// CORS-Header setzen (mit Preflight-Support)
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowedOrigins = $config['cors']['allowed_origins'];

// Sicherheit: In Produktion sollte '*' nicht verwendet werden
// Prüfe ob Origin erlaubt ist
if (in_array('*', $allowedOrigins)) {
    // Entwicklung: Erlaube alle Origins (nur für Entwicklung!)
    header('Access-Control-Allow-Origin: *');
} elseif (!empty($origin) && in_array($origin, $allowedOrigins)) {
    // Produktion: Nur erlaubte Origins
    header('Access-Control-Allow-Origin: ' . $origin);
} elseif (!empty($allowedOrigins) && !in_array('*', $allowedOrigins)) {
    // Fallback: Erste erlaubte Origin (nur wenn nicht '*')
    header('Access-Control-Allow-Origin: ' . $allowedOrigins[0]);
} else {
    // Keine CORS-Konfiguration - keine Header setzen
}

header('Access-Control-Allow-Methods: ' . implode(', ', $config['cors']['allowed_methods']));
header('Access-Control-Allow-Headers: ' . implode(', ', $config['cors']['allowed_headers']));
header('Access-Control-Max-Age: 86400'); // 24 Stunden Cache für Preflight
header('Content-Type: application/json; charset=utf-8');

// Preflight-Request behandeln (nur wenn über HTTP aufgerufen)
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

