<?php
/**
 * Route Distance API Endpoint
 * 
 * Berechnet die Distanz und geschätzte Fahrzeit zwischen zwei Punkten.
 * 
 * GET-Parameter:
 * - fromLat: Start-Breitengrad (float)
 * - fromLng: Start-Längengrad (float)
 * - toLat: Ziel-Breitengrad (float)
 * - toLng: Ziel-Längengrad (float)
 * 
 * Antwort: JSON-Objekt mit distanceKm und durationMinutes
 * 
 * HINWEIS: Aktuell wird eine Haversine-Distanz-Berechnung verwendet.
 * Dies ist eine Luftlinien-Distanz und keine echte Fahrdistanz.
 * 
 * Für eine echte Implementierung sollte hier eine Routing-API eingebunden werden, z.B.:
 * - Google Directions API
 * - OpenRouteService (kostenlos)
 * - OSRM (Open Source Routing Machine)
 * - Mapbox Directions API
 * 
 * Die aktuelle Implementierung dient als Platzhalter und kann leicht durch echte API-Calls ersetzt werden.
 */

// Error-Handling: Fange alle Fehler ab und gebe JSON zurück
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Lade Error-Handler
require_once __DIR__ . '/errorHandler.php';

// Lade HTTP Request Helper
require_once __DIR__ . '/httpRequest.php';

// Setze Error-Handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if ($errno === E_ERROR || $errno === E_PARSE || $errno === E_CORE_ERROR || $errno === E_COMPILE_ERROR) {
        logError('PHP_ERROR', "PHP Error [$errno]: $errstr", [
            'file' => $errfile,
            'line' => $errline
        ]);
    }
    return true;
});

set_exception_handler(function($exception) {
    sendErrorResponse(
        'UNHANDLED_EXCEPTION',
        'Ein unerwarteter Fehler ist aufgetreten',
        $exception->getMessage(),
        [],
        500,
        $exception
    );
});

try {
    require_once 'config.php';
} catch (Exception $e) {
    sendErrorResponse(
        'CONFIG_ERROR',
        'Konfigurationsfehler',
        'Fehler beim Laden der Konfiguration: ' . $e->getMessage(),
        [],
        500,
        $e
    );
}

// Parameter auslesen und validieren
$params = [
    'fromLat' => isset($_GET['fromLat']) ? $_GET['fromLat'] : null,
    'fromLng' => isset($_GET['fromLng']) ? $_GET['fromLng'] : null,
    'toLat' => isset($_GET['toLat']) ? $_GET['toLat'] : null,
    'toLng' => isset($_GET['toLng']) ? $_GET['toLng'] : null
];

$validationRules = [
    'fromLat' => ['required' => true, 'type' => 'float', 'min' => -90, 'max' => 90],
    'fromLng' => ['required' => true, 'type' => 'float', 'min' => -180, 'max' => 180],
    'toLat' => ['required' => true, 'type' => 'float', 'min' => -90, 'max' => 90],
    'toLng' => ['required' => true, 'type' => 'float', 'min' => -180, 'max' => 180]
];

$validationErrors = validateParams($params, $validationRules);
if ($validationErrors !== null) {
    $errorMessages = array_map(function($err) { return $err['message']; }, $validationErrors);
    sendErrorResponse(
        'VALIDATION_ERROR',
        'Ungültige Koordinaten',
        'Validierungsfehler: ' . implode(', ', $errorMessages),
        ['validation_errors' => $validationErrors],
        400
    );
}

$fromLat = floatval($params['fromLat']);
$fromLng = floatval($params['fromLng']);
$toLat = floatval($params['toLat']);
$toLng = floatval($params['toLng']);

// ============================================
// HAVERSINE-FUNKTION (wird für Fallback benötigt)
// ============================================
if (!function_exists('haversineDistance')) {
    function haversineDistance($lat1, $lng1, $lat2, $lng2) {
        $earthRadius = 6371; // Erdradius in km
        
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);
        
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        
        return $earthRadius * $c;
    }
}

// ============================================
// OPENROUTESERVICE API INTEGRATION
// ============================================
$distanceKm = null;
$durationMinutes = null;
$apiError = null;

// Versuche OpenRouteService API wenn API-Key vorhanden
if (!empty($config['routingApiKey'])) {
    try {
        $apiKey = $config['routingApiKey'];
        
        // OpenRouteService verwendet POST mit JSON-Body
        // Format: {"coordinates":[[lng1,lat1],[lng2,lat2]]}
        $requestBody = json_encode([
            'coordinates' => [
                [$fromLng, $fromLat],
                [$toLng, $toLat]
            ]
        ]);
        
        $apiUrl = $config['apiEndpoints']['openrouteservice'] . '/directions/driving-car?api_key=' . urlencode($apiKey);
        
        // API-Call mit HTTP Request Helper (unterstützt cURL-Fallback)
        $response = httpRequest($apiUrl, [
            'method' => 'POST',
            'timeout' => 10,
            'headers' => [
                'Content-Type: application/json',
                'Accept: application/json',
                'User-Agent: TankCopilot/1.0'
            ],
            'content' => $requestBody
        ]);
        
        if ($response === false) {
            throw new Exception('API-Anfrage fehlgeschlagen');
        }
        
        $data = json_decode($response, true);
        
        // Prüfe API-Response
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Ungültige JSON-Antwort von API: ' . json_last_error_msg());
        }
        
        // OpenRouteService Format: routes[0].summary.distance (in Metern) und duration (in Sekunden)
        if (isset($data['routes']) && is_array($data['routes']) && count($data['routes']) > 0) {
            $route = $data['routes'][0];
            if (isset($route['summary']['distance']) && isset($route['summary']['duration'])) {
                $distanceKm = $route['summary']['distance'] / 1000; // Konvertiere Meter zu km
                $durationMinutes = $route['summary']['duration'] / 60; // Konvertiere Sekunden zu Minuten
            } else {
                throw new Exception('Unerwartete API-Antwort: summary fehlt');
            }
        } else if (isset($data['error'])) {
            $apiError = isset($data['error']['message']) ? $data['error']['message'] : 'API-Fehler';
            throw new Exception('API-Fehler: ' . $apiError);
        } else {
            throw new Exception('Unerwartete API-Antwort: keine routes gefunden');
        }
        
    } catch (Exception $e) {
        // Bei Fehler: Logge detailliert
        logError('ERROR', 'OpenRouteService API Fehler', [
            'error_message' => $e->getMessage(),
            'api_url' => $apiUrl,
            'request_body' => $requestBody,
            'coordinates' => [
                'from' => [$fromLat, $fromLng],
                'to' => [$toLat, $toLng]
            ]
        ], $e);
        
        $apiError = $e->getMessage();
        // Fallback zu Haversine wird weiter unten ausgeführt
    }
}

// ============================================
// FALLBACK: HAVERSINE-DISTANZ BERECHNUNG (Luftlinie)
// ============================================
// Wird verwendet wenn API-Key fehlt oder API-Fehler auftritt
if ($distanceKm === null) {
    $distanceKm = haversineDistance($fromLat, $fromLng, $toLat, $toLng);
    
    // Geschätzte Fahrzeit (Durchschnittsgeschwindigkeit 50 km/h)
    $avgSpeedKmh = 50;
    $durationMinutes = ($distanceKm / $avgSpeedKmh) * 60;
}

// Bestimme Quelle der Daten
// Wenn API erfolgreich war und keine Fehler, dann von OpenRouteService
$source = 'haversine';
if (!empty($config['routingApiKey']) && $apiError === null) {
    // Wenn distanceKm gesetzt wurde und nicht null ist, wurde die API verwendet
    // (da distanceKm nur in der API-Sektion gesetzt wird, nicht im Fallback)
    // Prüfe durch Vergleich: API-Distanz ist normalerweise größer als Haversine
    $haversineDist = haversineDistance($fromLat, $fromLng, $toLat, $toLng);
    // API-Distanz ist normalerweise >= Haversine (Straßen sind länger als Luftlinie)
    // Aber wir prüfen ob wir die API aufgerufen haben durch Prüfung ob $apiError null ist
    // und ob die Distanz plausibel ist (nicht exakt Haversine)
    if (abs($distanceKm - $haversineDist) > 0.05 || $distanceKm > $haversineDist * 1.01) {
        $source = 'openrouteservice';
    }
}

// Antwort senden
try {
    $response = [
        'distanceKm' => round($distanceKm, 2),
        'durationMinutes' => round($durationMinutes, 0),
        'source' => $source,
        'apiError' => $apiError
    ];
    
    // In Development: Füge Debug-Informationen hinzu
    global $isDevelopment;
    if ($isDevelopment && isset($haversineDist)) {
        $response['debug'] = [
            'haversine_distance' => round($haversineDist, 2),
            'api_distance' => round($distanceKm, 2),
            'difference' => round(abs($distanceKm - $haversineDist), 2)
        ];
    }
    
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    sendErrorResponse(
        'RESPONSE_ERROR',
        'Fehler beim Erstellen der Antwort',
        'Fehler beim JSON-Encoding: ' . $e->getMessage(),
        [
            'distance_km' => $distanceKm,
            'duration_minutes' => $durationMinutes
        ],
        500,
        $e
    );
}

