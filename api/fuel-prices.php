<?php
/**
 * Fuel Prices API Endpoint
 * 
 * Liefert Tankstellendaten in der Nähe einer gegebenen Position.
 * Verwendet die Tankerkönig API für echte Spritpreise, fallback zu Mock-Daten.
 * 
 * GET-Parameter:
 * - lat: Breitengrad (float)
 * - lng: Längengrad (float)
 * - radiusKm: Suchradius in km (float, default: 10)
 * - fuelType: Spritart (string, z.B. "e5", "e10", "diesel")
 * 
 * Antwort: JSON-Array von Station-Objekten mit folgender Struktur:
 * {
 *   "id": "string",
 *   "name": "string",
 *   "street": "string",
 * "postalCode": "string",
 *   "city": "string",
 *   "isSB": boolean,
 *   "lat": float,
 *   "lng": float,
 *   "fuelType": "string",
 *   "pricePerLiter": float,
 *   "lastUpdate": "ISO8601",
 *   "isMock": boolean
 * }
 */

// Error-Handling: Fange alle Fehler ab und gebe JSON zurück
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Lade Error-Handler
require_once __DIR__ . '/errorHandler.php';

// Setze Error-Handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    // Nur kritische Fehler loggen
    if ($errno === E_ERROR || $errno === E_PARSE || $errno === E_CORE_ERROR || $errno === E_COMPILE_ERROR) {
        logError('PHP_ERROR', "PHP Error [$errno]: $errstr", [
            'file' => $errfile,
            'line' => $errline,
            'errno' => $errno
        ]);
    }
    return true;
});

// Setze Exception-Handler
set_exception_handler(function($exception) {
    sendErrorResponse(
        'UNHANDLED_EXCEPTION',
        'Ein unerwarteter Fehler ist aufgetreten',
        $exception->getMessage(),
        [
            'file' => $exception->getFile(),
            'line' => $exception->getLine()
        ],
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
        [
            'config_file' => __DIR__ . '/config.php',
            'exception_type' => get_class($e)
        ],
        500,
        $e
    );
}

// Parameter auslesen und validieren
$params = [
    'lat' => isset($_GET['lat']) ? $_GET['lat'] : null,
    'lng' => isset($_GET['lng']) ? $_GET['lng'] : null,
    'radiusKm' => isset($_GET['radiusKm']) ? $_GET['radiusKm'] : 10,
    'fuelType' => isset($_GET['fuelType']) ? $_GET['fuelType'] : 'e5'
];

// Validierungsregeln
$validationRules = [
    'lat' => [
        'required' => true,
        'type' => 'float',
        'min' => -90,
        'max' => 90
    ],
    'lng' => [
        'required' => true,
        'type' => 'float',
        'min' => -180,
        'max' => 180
    ],
    'radiusKm' => [
        'required' => false,
        'type' => 'float',
        'min' => 0.1,
        'max' => 25
    ],
    'fuelType' => [
        'required' => false,
        'type' => 'string',
        'pattern' => '/^(e5|e10|diesel|lpg|cng|h2|elektro)$/i'
    ]
];

// Validiere Parameter
$validationErrors = validateParams($params, $validationRules);
if ($validationErrors !== null) {
    $errorMessages = array_map(function($err) {
        return $err['message'];
    }, $validationErrors);
    
    sendErrorResponse(
        'VALIDATION_ERROR',
        'Ungültige Parameter',
        'Validierungsfehler: ' . implode(', ', $errorMessages),
        ['validation_errors' => $validationErrors],
        400
    );
}

// Konvertiere zu korrekten Typen
$lat = floatval($params['lat']);
$lng = floatval($params['lng']);
$radiusKm = floatval($params['radiusKm']);
$fuelType = strtolower(trim($params['fuelType']));

// Lade Station Cache
require_once __DIR__ . '/stationCache.php';
$stationCache = new StationCache();

// Lade HTTP Request Helper
require_once __DIR__ . '/httpRequest.php';

// Tankerkönig API Fuel-Type Mapping
$fuelTypeMap = [
    'e5' => 'e5',
    'e10' => 'e10',
    'diesel' => 'diesel',
    'lpg' => 'lpg',
    'cng' => 'cng',
    'h2' => 'h2',
    'elektro' => 'e5' // Fallback für Elektro
];

$tankerkoenigType = isset($fuelTypeMap[$fuelType]) ? $fuelTypeMap[$fuelType] : 'e5';

// ============================================
// TANKERKÖNIG API INTEGRATION
// ============================================

$stations = [];
$isMockData = false;
$apiError = null;
$dataSource = 'mock'; // 'cache', 'cache-updated', 'tankerkoenig', 'geisenhausen-fallback', oder 'mock'
$fromCache = false;

// ============================================
// CACHE-PRÜFUNG (Erste Priorität)
// ============================================
// Prüfe zuerst Cache für Stationen-Positionen
$cachedStations = $stationCache->getCachedStations($lat, $lng, $radiusKm);
if ($cachedStations !== null && !empty($cachedStations)) {
    // Filtere nach Fuel-Type
    $cachedStationsFiltered = array_filter($cachedStations, function($station) use ($fuelType) {
        return isset($station['fuelType']) && $station['fuelType'] === $fuelType;
    });
    
    if (!empty($cachedStationsFiltered)) {
        $fromCache = true;
        logError('INFO', 'Stationen aus Cache geladen', [
            'cached_count' => count($cachedStationsFiltered),
            'fuel_type' => $fuelType
        ]);
        
        // Versuche Preise zu aktualisieren (nur wenn API-Key vorhanden)
        if (!empty($config['fuelPriceApiKey'])) {
            try {
                $tankerkoenigType = isset($fuelTypeMap[$fuelType]) ? $fuelTypeMap[$fuelType] : $fuelType;
                $apiKey = $config['fuelPriceApiKey'];
                $apiUrl = $config['apiEndpoints']['tankerkoenig'] . '/list.php';
                $apiUrl .= '?lat=' . urlencode($lat);
                $apiUrl .= '&lng=' . urlencode($lng);
                $apiUrl .= '&rad=' . min($radiusKm, 25);
                $apiUrl .= '&type=' . urlencode($tankerkoenigType);
                $apiUrl .= '&sort=price';
                $apiUrl .= '&apikey=' . urlencode($apiKey);
                
                // API-Call mit HTTP Request Helper (unterstützt cURL-Fallback)
                $response = httpRequest($apiUrl, [
                    'method' => 'GET',
                    'timeout' => 10,
                    'headers' => [
                        'User-Agent: TankCopilot/1.0 (PHP/' . PHP_VERSION . ')',
                        'Accept: application/json'
                    ]
                ]);
                
                if ($response !== false && !empty($response)) {
                    $data = json_decode($response, true);
                    
                    if (isset($data['ok']) && $data['ok'] === true && isset($data['stations']) && is_array($data['stations'])) {
                        // Aktualisiere Preise für gecachte Stationen
                        $priceUpdates = [];
                        foreach ($cachedStationsFiltered as &$cachedStation) {
                            // Finde passende Station aus API-Response (nach Koordinaten)
                            foreach ($data['stations'] as $apiStation) {
                                if (isset($apiStation['lat']) && isset($apiStation['lng']) && isset($apiStation['price'])) {
                                    $distance = abs($cachedStation['lat'] - floatval($apiStation['lat'])) + abs($cachedStation['lng'] - floatval($apiStation['lng']));
                                    if ($distance < 0.001) { // Sehr nah beieinander (gleiche Station)
                                        $price = floatval($apiStation['price']);
                                        if ($price > 0) {
                                            $cachedStation['pricePerLiter'] = round($price, 3);
                                            $cachedStation['isSB'] = isset($apiStation['isOpen']) && $apiStation['isOpen'] === true;
                                            $cachedStation['lastUpdate'] = date('c');
                                            $cachedStation['isMock'] = false;
                                            
                                            if (isset($cachedStation['id'])) {
                                                $priceUpdates[$cachedStation['id']] = [
                                                    'pricePerLiter' => $cachedStation['pricePerLiter'],
                                                    'isSB' => $cachedStation['isSB'],
                                                    'lastUpdate' => $cachedStation['lastUpdate'],
                                                    'isMock' => false
                                                ];
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // Aktualisiere Cache mit neuen Preisen
                        if (!empty($priceUpdates)) {
                            $stationCache->updatePrices($priceUpdates);
                            logError('INFO', 'Preise für gecachte Stationen aktualisiert', [
                                'stations_updated' => count($priceUpdates)
                            ]);
                        }
                        
                        $stations = array_values($cachedStationsFiltered);
                        $isMockData = false;
                        $dataSource = 'cache-updated';
                    } else {
                        // API-Fehler: Verwende gecachte Stationen mit alten Preisen
                        $stations = array_values($cachedStationsFiltered);
                        $dataSource = 'cache';
                    }
                } else {
                    // API-Fehler: Verwende gecachte Stationen mit alten Preisen
                    $stations = array_values($cachedStationsFiltered);
                    $dataSource = 'cache';
                }
            } catch (Exception $e) {
                logError('WARNING', 'Fehler beim Aktualisieren der Preise', [
                    'error' => $e->getMessage()
                ]);
                // Verwende gecachte Stationen mit alten Preisen
                $stations = array_values($cachedStationsFiltered);
                $dataSource = 'cache';
            }
        } else {
            // Kein API-Key: Verwende gecachte Stationen
            $stations = array_values($cachedStationsFiltered);
            $dataSource = 'cache';
        }
    }
}

// ============================================
// TANKERKÖNIG API (Zweite Priorität - wenn kein Cache)
// ============================================
// Versuche echte API zu verwenden wenn API-Key vorhanden

if (empty($stations) && !empty($config['fuelPriceApiKey']) && !$fromCache) {
    // Debug-Logging für Livebetrieb
    error_log('Tankerkönig API: Versuche API-Aufruf. Key vorhanden: ' . (!empty($config['fuelPriceApiKey']) ? 'JA (' . substr($config['fuelPriceApiKey'], 0, 10) . '...)' : 'NEIN'));
    error_log('Tankerkönig API: Parameter - lat=' . $lat . ', lng=' . $lng . ', radius=' . $radiusKm . ', type=' . $tankerkoenigType);
    try {
        $apiKey = $config['fuelPriceApiKey'];
        // Tankerkönig API verwendet /json/list.php mit anderen Parametern
        $apiUrl = $config['apiEndpoints']['tankerkoenig'] . '/list.php';
        $apiUrl .= '?lat=' . urlencode($lat);
        $apiUrl .= '&lng=' . urlencode($lng);
        $apiUrl .= '&rad=' . min($radiusKm, 25); // Max 25km für Tankerkönig, Parameter heißt 'rad' nicht 'radius'
        $apiUrl .= '&type=' . urlencode($tankerkoenigType);
        $apiUrl .= '&sort=price'; // Sortiere nach Preis
        $apiUrl .= '&apikey=' . urlencode($apiKey);
        
        // API-Call mit HTTP Request Helper (unterstützt cURL-Fallback)
        $response = httpRequest($apiUrl, [
            'method' => 'GET',
            'timeout' => 10,
            'headers' => [
                'User-Agent: TankCopilot/1.0 (PHP/' . PHP_VERSION . ')',
                'Accept: application/json',
                'Accept-Language: de-DE,de;q=0.9'
            ]
        ]);
        
        if ($response === false) {
            $errorDetails = [];
            $errorMsg = 'API-Anfrage fehlgeschlagen';
            
            // Prüfe PHP-Konfiguration
            $allowUrlFopen = ini_get('allow_url_fopen');
            $curlAvailable = function_exists('curl_init');
            
            if (!$allowUrlFopen && !$curlAvailable) {
                $errorDetails['php_config'] = 'allow_url_fopen ist deaktiviert und cURL nicht verfügbar';
                $errorMsg .= ' (allow_url_fopen ist deaktiviert und cURL nicht verfügbar - bitte eine der Optionen aktivieren)';
            } elseif (!$allowUrlFopen) {
                $errorDetails['php_config'] = 'allow_url_fopen ist deaktiviert, verwende cURL';
                // cURL sollte funktionieren, daher keine zusätzliche Fehlermeldung
            }
            
            $errorDetails['api_url'] = $apiUrl;
            $errorDetails['api_key_length'] = strlen($apiKey);
            $errorDetails['allow_url_fopen'] = $allowUrlFopen;
            $errorDetails['curl_available'] = $curlAvailable;
            
            logError('ERROR', 'Tankerkönig API Request fehlgeschlagen', $errorDetails);
            throw new Exception($errorMsg);
        }
        
        // Prüfe ob Response leer ist
        if (empty($response)) {
            logError('WARNING', 'Tankerkönig API: Leere Response erhalten', [
                'api_url' => $apiUrl,
                'response_length' => 0
            ]);
            throw new Exception('API-Antwort ist leer - möglicherweise Rate-Limiting oder Server-Problem');
        }
        
        // Logge Response für Debugging (nur erste 500 Zeichen für besseres Debugging)
        error_log('Tankerkönig API Response (erste 500 Zeichen): ' . substr($response, 0, 500));
        
        $data = json_decode($response, true);
        
        // Prüfe API-Response
        if (json_last_error() !== JSON_ERROR_NONE) {
            $jsonError = json_last_error_msg();
            logError('ERROR', 'Tankerkönig API JSON-Parse-Fehler', [
                'json_error' => $jsonError,
                'json_error_code' => json_last_error(),
                'response_preview' => substr($response, 0, 500),
                'response_length' => strlen($response)
            ]);
            throw new Exception('Ungültige JSON-Antwort von API: ' . $jsonError);
        }
        
        // Prüfe ob Response-Struktur korrekt ist
        if (!isset($data['ok'])) {
            logError('WARNING', 'Tankerkönig API: Response hat kein "ok" Feld', [
                'response_keys' => array_keys($data),
                'response_structure' => $data
            ]);
        }
        
        if (isset($data['ok']) && $data['ok'] === true && isset($data['stations']) && is_array($data['stations'])) {
            error_log('Tankerkönig API: ' . count($data['stations']) . ' Stationen gefunden');
            
            // Konvertiere Tankerkönig-Format zu unserem Format
            $stationsProcessed = 0;
            $stationsSkipped = 0;
            foreach ($data['stations'] as $station) {
                // Überspringe Stationen ohne erforderliche Felder
                if (!isset($station['lat']) || !isset($station['lng']) || !isset($station['price'])) {
                    $stationsSkipped++;
                    logError('WARNING', 'Tankerkönig API: Station übersprungen - fehlende Felder', [
                        'station_id' => isset($station['id']) ? $station['id'] : 'unbekannt',
                        'station_name' => isset($station['name']) ? $station['name'] : 'unbekannt',
                        'has_lat' => isset($station['lat']),
                        'has_lng' => isset($station['lng']),
                        'has_price' => isset($station['price']),
                        'station_keys' => array_keys($station)
                    ]);
                    continue;
                }
                
                // Preis ist direkt im 'price' Feld (bereits in EUR)
                $price = floatval($station['price']);
                if ($price <= 0) {
                    continue; // Überspringe Stationen ohne Preis
                }
                
                // Parse Adresse
                $street = isset($station['street']) ? $station['street'] : '';
                $houseNumber = isset($station['houseNumber']) ? $station['houseNumber'] : '';
                $fullStreet = trim($street . ' ' . $houseNumber);
                $postalCode = isset($station['postCode']) ? strval($station['postCode']) : '';
                $city = isset($station['place']) ? $station['place'] : '';
                
                // Bestimme ob SB-Tankstelle (basierend auf isOpen)
                $isSB = isset($station['isOpen']) && $station['isOpen'] === true;
                $brandName = isset($station['brand']) && !empty($station['brand']) 
                    ? $station['brand'] 
                    : (isset($station['name']) ? $station['name'] : 'Unbekannt');
                
                $stations[] = [
                    'id' => isset($station['id']) ? $station['id'] : 'station_' . uniqid(),
                    'name' => $brandName,
                    'street' => $fullStreet,
                    'postalCode' => $postalCode,
                    'city' => $city,
                    'isSB' => $isSB,
                    'lat' => floatval($station['lat']),
                    'lng' => floatval($station['lng']),
                    'fuelType' => $fuelType,
                    'pricePerLiter' => round($price, 3), // Preis ist bereits in EUR
                    'lastUpdate' => date('c'), // Tankerkönig list.php gibt kein timestamp
                    'isMock' => false
                ];
                $stationsProcessed++;
            }
            
            error_log('Tankerkönig API: ' . $stationsProcessed . ' Stationen verarbeitet, ' . $stationsSkipped . ' übersprungen');
            
            // Sortiere nach Preis (günstigste zuerst)
            if (!empty($stations)) {
                usort($stations, function($a, $b) {
                    return $a['pricePerLiter'] <=> $b['pricePerLiter'];
                });
            }
            
            error_log('Tankerkönig API: ' . count($stations) . ' Stationen nach Filterung');
            
            // Nur wenn Stationen gefunden wurden, verwende echte Daten
            if (count($stations) > 0) {
                $isMockData = false;
                $apiError = null;
                $dataSource = 'tankerkoenig';
                
                // Speichere Stationen im Cache
                $stationCache->saveStations($stations);
                logError('INFO', 'Stationen im Cache gespeichert', [
                    'station_count' => count($stations)
                ]);
            } else {
                error_log('Tankerkönig API: Keine Stationen nach Filterung - verwende Mock-Daten');
                $isMockData = true;
                $apiError = 'Keine Stationen im angegebenen Radius gefunden';
                $dataSource = 'mock';
            }
            
        } else if (isset($data['ok']) && $data['ok'] === false) {
            // API-Fehlermeldung
            $apiError = isset($data['message']) ? $data['message'] : 'API-Fehler (ok=false)';
            error_log('Tankerkönig API Fehler: ' . $apiError);
            // Fallback zu Mock-Daten
        } else if (isset($data['message'])) {
            // API-Fehlermeldung
            $apiError = $data['message'];
            error_log('Tankerkönig API Fehler: ' . $apiError);
            // Fallback zu Mock-Daten
        } else {
            // Unerwartete Antwort - logge für Debugging
            error_log('Tankerkönig API: Unerwartete Antwort. Response: ' . substr($response, 0, 500));
            $apiError = 'Unerwartete API-Antwort';
            // Fallback zu Mock-Daten
        }
        
    } catch (Exception $e) {
        // Bei Fehler: Logge detailliert
        logError('ERROR', 'Tankerkönig API Fehler', [
            'error_message' => $e->getMessage(),
            'error_code' => $e->getCode(),
            'api_url' => isset($apiUrl) ? $apiUrl : 'nicht gesetzt',
            'request_params' => [
                'lat' => $lat,
                'lng' => $lng,
                'radius' => $radiusKm,
                'type' => $tankerkoenigType
            ]
        ], $e);
        
        $apiError = $e->getMessage();
        // Fallback zu Mock-Daten wird weiter unten ausgeführt
    }
}

// ============================================
// FALLBACK: GEISENHAUSEN (84144) - 30km Radius
// ============================================
// Hardcoded Tankstellen-Daten für Geisenhausen und Umgebung (30km Radius)
// Koordinaten Geisenhausen: 48.4489° N, 12.2564° E

// Prüfe ob Koordinaten in der Nähe von Geisenhausen sind (30km Radius)
$geisenhausenLat = 48.4489;
$geisenhausenLng = 12.2564;
$geisenhausenRadius = 30; // km

// Haversine-Funktion für Distanzberechnung (wenn nicht bereits definiert)
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

$distanceToGeisenhausen = haversineDistance($lat, $lng, $geisenhausenLat, $geisenhausenLng);

// Wenn in der Nähe von Geisenhausen, verwende Fallback-Daten
if (empty($stations) && $distanceToGeisenhausen <= $geisenhausenRadius) {
    // Hardcoded Tankstellen für Geisenhausen (30km Radius)
    // Daten vom 2025-11-16, abgerufen via Tankerkönig API
    $geisenhausenFallback = include __DIR__ . '/geisenhausen_fallback_all.php';
    
    if (is_array($geisenhausenFallback) && !empty($geisenhausenFallback)) {
        // Filtere nach angefragtem Kraftstofftyp
        foreach ($geisenhausenFallback as $station) {
            if (isset($station['fuelType']) && $station['fuelType'] === $fuelType) {
                // Berechne Distanz vom angefragten Standort
                $stationDistance = haversineDistance($lat, $lng, $station['lat'], $station['lng']);
                
                // Nur Stationen im angefragten Radius
                if ($stationDistance <= $radiusKm) {
                    $stations[] = $station;
                }
            }
        }
        
        // Sortiere nach Preis
        if (!empty($stations)) {
            usort($stations, function($a, $b) {
                return $a['pricePerLiter'] <=> $b['pricePerLiter'];
            });
            
            $isMockData = false;
            $dataSource = 'geisenhausen-fallback';
            error_log('Geisenhausen Fallback: ' . count($stations) . ' Stationen gefunden');
        }
    }
}

// ============================================
// MOCK-DATEN GENERIERUNG (Fallback)
// ============================================
// Wird verwendet wenn API-Key fehlt oder API-Fehler auftritt
// Oder wenn nicht in der Nähe von Geisenhausen

if (empty($stations)) {
    $isMockData = true;
    
    // Generische Station-Namen (ohne spezifische Stadt-Referenzen)
    $stationBrands = [
        ['name' => 'Shell', 'isSB' => true],
        ['name' => 'Aral', 'isSB' => false],
        ['name' => 'Esso', 'isSB' => true],
        ['name' => 'Total', 'isSB' => true],
        ['name' => 'BP', 'isSB' => false],
        ['name' => 'JET', 'isSB' => true],
        ['name' => 'HEM', 'isSB' => true],
        ['name' => 'OMV', 'isSB' => false],
        ['name' => 'AVIA', 'isSB' => true],
        ['name' => 'Q8', 'isSB' => true],
        ['name' => 'Agip', 'isSB' => false],
        ['name' => 'Star', 'isSB' => true]
    ];

    // Generische Straßennamen
$streetNames = [
    'Hauptstraße', 'Bahnhofstraße', 'Dorfstraße', 'Kirchstraße', 'Schulstraße',
    'Gartenstraße', 'Parkstraße', 'Waldstraße', 'Bergstraße', 'Talstraße',
    'Ringstraße', 'Allee', 'Weg', 'Platz', 'Straße'
];

// Generiere 8-12 zufällige Tankstellen in der Nähe (inkl. SB-Tankstellen)
$numStations = rand(8, 12);
$usedIndices = [];

for ($i = 0; $i < $numStations; $i++) {
    // Wähle zufällige Station (ohne Duplikate)
    do {
        $stationIndex = rand(0, count($stationBrands) - 1);
    } while (in_array($stationIndex, $usedIndices) && count($usedIndices) < count($stationBrands));
    $usedIndices[] = $stationIndex;
    
    $stationBrand = $stationBrands[$stationIndex];
    
    // Realistischere Distanzverteilung (mehr Stationen näher, weniger weiter weg)
    $angle = deg2rad(rand(0, 360));
    $distanceFactor = rand(1, 100) / 100;
    $distance = $radiusKm * sqrt($distanceFactor); // Quadratische Verteilung für realistischere Verteilung
    
    // Präzisere Koordinatenberechnung
    $latOffset = ($distance * cos($angle)) / 111.32;
    $lngOffset = ($distance * sin($angle)) / (111.32 * cos(deg2rad($lat)));
    
    $stationLat = $lat + $latOffset;
    $stationLng = $lng + $lngOffset;
    
    // Realistischere Preisvariation (1.65 - 2.05 EUR)
    // Generiere Preise in 0.1 Cent Schritten (wie bei echten Spritpreisen)
    $minPrice = 1650; // 1.650 EUR in Cent
    $maxPrice = 2050; // 2.050 EUR in Cent
    $priceInCents = rand($minPrice, $maxPrice);
    // Konvertiere zu Euro mit 3 Dezimalstellen
    $pricePerLiter = round($priceInCents / 1000, 3);
    
    // Generiere zufällige Adressdaten basierend auf Koordinaten
    $houseNumber = rand(1, 200);
    $streetName = $streetNames[array_rand($streetNames)];
    $postalCode = str_pad(rand(10000, 99999), 5, '0', STR_PAD_LEFT);
    
    // Verwende Reverse Geocoding-ähnliche Logik: Generiere generische Stadt basierend auf Koordinaten
    // In einer echten Implementierung würde hier ein Reverse Geocoding Service verwendet
    $city = 'Stadt'; // Generischer Platzhalter, da echte Stadt aus Koordinaten nur mit API möglich
    
    $stations[] = [
        'id' => 'station_' . ($i + 1),
        'name' => $stationBrand['name'],
        'street' => $streetName . ' ' . $houseNumber,
        'postalCode' => $postalCode,
        'city' => $city,
        'isSB' => $stationBrand['isSB'],
        'lat' => round($stationLat, 7),
        'lng' => round($stationLng, 7),
        'fuelType' => $fuelType,
        'pricePerLiter' => $pricePerLiter,
        'lastUpdate' => date('c'),
        'isMock' => true
    ];
}
} // Ende if (empty($stations))

// Antwort senden
$response = [
    'stations' => $stations,
    'meta' => [
        'count' => count($stations),
        'isMock' => $isMockData,
        'apiError' => $apiError,
        'timestamp' => date('c'),
        'source' => $dataSource, // 'cache', 'cache-updated', 'tankerkoenig', 'geisenhausen-fallback', oder 'mock'
        'query' => [
            'lat' => $lat,
            'lng' => $lng,
            'radiusKm' => $radiusKm,
            'fuelType' => $fuelType
        ]
    ]
];

    // Wenn Mock-Daten verwendet werden, füge Warnung hinzu
    if ($isMockData) {
        $response['meta']['warning'] = 'Mock-Daten werden verwendet. Bitte konfigurieren Sie einen Tankerkönig API-Key für echte Spritpreise.';
    }
    
    // In Development: Füge Debug-Informationen hinzu
    global $isDevelopment;
    if ($isDevelopment) {
        $cacheStats = $stationCache->getCacheStats();
        $response['meta']['debug'] = [
            'api_key_configured' => !empty($config['fuelPriceApiKey']),
            'tankerkoenig_tried' => !empty($config['fuelPriceApiKey']) && !$fromCache,
            'geisenhausen_fallback_tried' => isset($distanceToGeisenhausen) && $distanceToGeisenhausen <= 30,
            'from_cache' => $fromCache,
            'cache_stats' => $cacheStats
        ];
    }
    
    // Füge Cache-Info hinzu
    $response['meta']['fromCache'] = $fromCache;

// Stelle sicher, dass keine Fehler vor der JSON-Ausgabe ausgegeben werden
if (ob_get_level() > 0) {
    ob_clean();
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

