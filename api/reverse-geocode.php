<?php
/**
 * Reverse Geocoding API Endpoint
 * 
 * Konvertiert Koordinaten zu einer Adresse.
 * 
 * GET-Parameter:
 * - lat: Breitengrad (float)
 * - lng: Längengrad (float)
 * 
 * Antwort: JSON-Objekt mit address-String
 */

// Error-Handling: Fange alle Fehler ab und gebe JSON zurück
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Lade Error-Handler
require_once __DIR__ . '/errorHandler.php';

// Lade HTTP Request Helper
require_once __DIR__ . '/httpRequest.php';

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
    'lat' => isset($_GET['lat']) ? $_GET['lat'] : null,
    'lng' => isset($_GET['lng']) ? $_GET['lng'] : null
];

$validationRules = [
    'lat' => ['required' => true, 'type' => 'float', 'min' => -90, 'max' => 90],
    'lng' => ['required' => true, 'type' => 'float', 'min' => -180, 'max' => 180]
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

$lat = floatval($params['lat']);
$lng = floatval($params['lng']);

$address = null;
$apiError = null;

// Verwende Nominatim (OpenStreetMap) - kostenlos und zuverlässig
// OpenRouteService Reverse Geocoding ist komplizierter, Nominatim ist einfacher
try {
    $nominatimUrl = 'https://nominatim.openstreetmap.org/reverse?format=json';
    $nominatimUrl .= '&lat=' . urlencode($lat);
    $nominatimUrl .= '&lon=' . urlencode($lng);
    // Höhere Zoom-Stufe für genauere Adressen (inkl. Hausnummern)
    $nominatimUrl .= '&zoom=18';
    $nominatimUrl .= '&addressdetails=1';
    $nominatimUrl .= '&extratags=1';
    
    // API-Call mit HTTP Request Helper (unterstützt cURL-Fallback)
    $response = httpRequest($nominatimUrl, [
        'method' => 'GET',
        'timeout' => 5,
        'headers' => [
            'User-Agent: TankCopilot/1.0',
            'Accept: application/json'
        ]
    ]);
    
    if ($response !== false) {
        $data = json_decode($response, true);
        
        if (json_last_error() === JSON_ERROR_NONE && isset($data['address'])) {
            $addr = $data['address'];
            $addressParts = [];
            
            // Baue Adresse MIT Hausnummer für genaue Standorterfassung:
            // Straße + Hausnummer, PLZ, Stadt
            
            if (isset($addr['road'])) {
                $street = $addr['road'];
                // Füge Hausnummer hinzu, falls vorhanden
                if (isset($addr['house_number'])) {
                    $street .= ' ' . $addr['house_number'];
                } else if (isset($addr['house'])) {
                    $street .= ' ' . $addr['house'];
                }
                $addressParts[] = $street;
            }
            
            if (isset($addr['postcode'])) {
                $addressParts[] = $addr['postcode'];
            }
            
            if (isset($addr['city']) || isset($addr['town']) || isset($addr['village'])) {
                $addressParts[] = $addr['city'] ?? $addr['town'] ?? $addr['village'];
            }
            
            if (!empty($addressParts)) {
                $address = implode(', ', $addressParts);
            } else if (isset($data['display_name'])) {
                // Fallback: Verwende display_name wenn keine strukturierte Adresse
                // Behalte Hausnummer in display_name für Genauigkeit
                $address = $data['display_name'];
            }
        }
    }
} catch (Exception $e) {
    logError('ERROR', 'Nominatim Reverse Geocoding Fehler', [
        'error_message' => $e->getMessage(),
        'coordinates' => ['lat' => $lat, 'lng' => $lng],
        'api_url' => isset($nominatimUrl) ? $nominatimUrl : 'nicht gesetzt'
    ], $e);
    
    $apiError = $e->getMessage();
}

// Antwort senden
try {
    $response = [
        'address' => $address,
        'lat' => $lat,
        'lng' => $lng,
        'apiError' => $apiError
    ];
    
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
            'address' => $address,
            'coordinates' => ['lat' => $lat, 'lng' => $lng]
        ],
        500,
        $e
    );
}

