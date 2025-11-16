<?php
/**
 * Geocoding API Endpoint
 * 
 * Konvertiert eine Adresse zu Koordinaten (Forward Geocoding).
 * 
 * GET-Parameter:
 * - address: Adresse (z.B. "Musterstraße 123, 80331 München")
 * - street: Straße (optional)
 * - postalCode: Postleitzahl (optional)
 * - city: Stadt (optional)
 * 
 * Antwort: JSON-Objekt mit lat, lng und formattedAddress
 */

// Error-Handling
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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

// Parameter auslesen
$address = isset($_GET['address']) ? trim($_GET['address']) : null;
$street = isset($_GET['street']) ? trim($_GET['street']) : null;
$postalCode = isset($_GET['postalCode']) ? trim($_GET['postalCode']) : null;
$city = isset($_GET['city']) ? trim($_GET['city']) : null;

// Validiere Parameter
if (empty($address) && (empty($street) || empty($city))) {
    sendErrorResponse(
        'VALIDATION_ERROR',
        'Ungültige Parameter',
        'Entweder "address" oder "street" + "city" müssen angegeben werden',
        [
            'received_params' => [
                'address' => $address,
                'street' => $street,
                'postalCode' => $postalCode,
                'city' => $city
            ]
        ],
        400
    );
}

// Baue Such-String
$searchQuery = $address;
if (empty($searchQuery)) {
    $searchParts = [];
    if (!empty($street)) $searchParts[] = $street;
    if (!empty($postalCode)) $searchParts[] = $postalCode;
    if (!empty($city)) $searchParts[] = $city;
    $searchQuery = implode(', ', $searchParts);
}

// Füge "Deutschland" hinzu für bessere Ergebnisse
$searchQuery .= ', Deutschland';

$coordinates = null;
$formattedAddress = null;
$apiError = null;

// Verwende Nominatim (OpenStreetMap) für Geocoding
try {
    $nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json';
    $nominatimUrl .= '&q=' . urlencode($searchQuery);
    $nominatimUrl .= '&limit=1';
    $nominatimUrl .= '&addressdetails=1';
    
    // API-Call mit HTTP Request Helper (unterstützt cURL-Fallback)
    $response = httpRequest($nominatimUrl, [
        'method' => 'GET',
        'timeout' => 5,
        'headers' => [
            'User-Agent: TankCopilot/1.0 (https://your-app-url.com)',
            'Accept: application/json'
        ]
    ]);
    
    if ($response === false) {
        throw new Exception('Geocoding API-Anfrage fehlgeschlagen');
    }
    
    $data = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Ungültige JSON-Antwort von Nominatim: ' . json_last_error_msg());
    }
    
    if (is_array($data) && count($data) > 0) {
        $result = $data[0];
        $coordinates = [
            'lat' => floatval($result['lat']),
            'lng' => floatval($result['lon'])
        ];
        $formattedAddress = isset($result['display_name']) ? $result['display_name'] : $searchQuery;
    } else {
        throw new Exception('Adresse nicht gefunden');
    }
    
} catch (Exception $e) {
    logError('ERROR', 'Nominatim Geocoding Fehler', [
        'error_message' => $e->getMessage(),
        'search_query' => $searchQuery,
        'api_url' => isset($nominatimUrl) ? $nominatimUrl : 'nicht gesetzt'
    ], $e);
    
    $apiError = $e->getMessage();
}

// Antwort senden
try {
    $response = [
        'coordinates' => $coordinates,
        'formattedAddress' => $formattedAddress,
        'searchQuery' => $searchQuery,
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
            'coordinates' => $coordinates,
            'formattedAddress' => $formattedAddress
        ],
        500,
        $e
    );
}

