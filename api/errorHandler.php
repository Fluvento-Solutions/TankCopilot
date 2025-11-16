<?php
/**
 * Error Handler für TankCopilot API
 * 
 * Zentrale Fehlerbehandlung mit detailliertem Logging für Entwicklung und Produktion
 */

// Prüfe ob Entwicklungsmodus aktiviert ist
$isDevelopment = isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development';
$isDevelopment = $isDevelopment || (isset($_SERVER['HTTP_HOST']) && (
    strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
    strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false ||
    strpos($_SERVER['HTTP_HOST'], '.local') !== false
));

// Log-Datei-Pfad
$logFile = dirname(__DIR__) . '/logs/api-errors.log';
$logDir = dirname($logFile);

// Stelle sicher, dass Log-Verzeichnis existiert
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}

/**
 * Loggt eine Fehlermeldung
 * @param string $level - Log-Level (ERROR, WARNING, INFO, DEBUG)
 * @param string $message - Fehlermeldung
 * @param array $context - Zusätzlicher Kontext
 * @param Exception|null $exception - Exception-Objekt (optional)
 */
function logError($level, $message, $context = [], $exception = null) {
    global $logFile, $isDevelopment;
    
    $timestamp = date('Y-m-d H:i:s');
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'CLI';
    $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : 'CLI';
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'CLI';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'level' => $level,
        'message' => $message,
        'ip' => $ip,
        'request_uri' => $requestUri,
        'user_agent' => $userAgent,
        'context' => $context
    ];
    
    if ($exception !== null) {
        $logEntry['exception'] = [
            'message' => $exception->getMessage(),
            'code' => $exception->getCode(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $isDevelopment ? $exception->getTraceAsString() : null
        ];
    }
    
    // Logge in Datei
    $logLine = json_encode($logEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
    
    // Logge auch in PHP error_log wenn Development
    if ($isDevelopment) {
        $errorLogMessage = "[$level] $message";
        if (!empty($context)) {
            $errorLogMessage .= ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE);
        }
        if ($exception !== null) {
            $errorLogMessage .= ' | Exception: ' . $exception->getMessage() . ' in ' . $exception->getFile() . ':' . $exception->getLine();
        }
        error_log($errorLogMessage);
    }
}

/**
 * Erstellt eine strukturierte Fehler-Response
 * @param string $errorCode - Fehlercode (z.B. 'API_ERROR', 'VALIDATION_ERROR')
 * @param string $message - Fehlermeldung für Benutzer
 * @param string|null $detailMessage - Detaillierte Fehlermeldung (nur in Development)
 * @param array $additionalData - Zusätzliche Daten
 * @param int $httpStatusCode - HTTP-Status-Code
 * @return array - Strukturierte Fehler-Response
 */
function createErrorResponse($errorCode, $message, $detailMessage = null, $additionalData = [], $httpStatusCode = 500) {
    global $isDevelopment;
    
    $response = [
        'error' => true,
        'code' => $errorCode,
        'message' => $message,
        'timestamp' => date('c')
    ];
    
    // Füge detaillierte Informationen nur in Development hinzu
    if ($isDevelopment && $detailMessage !== null) {
        $response['detail'] = $detailMessage;
    }
    
    // Füge zusätzliche Daten hinzu
    if (!empty($additionalData)) {
        $response['data'] = $additionalData;
    }
    
    // In Development: Füge Request-Informationen hinzu
    if ($isDevelopment) {
        $response['debug'] = [
            'request_uri' => isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : null,
            'request_method' => isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : null,
            'query_params' => $_GET ?? [],
            'php_version' => PHP_VERSION
        ];
    }
    
    return [
        'response' => $response,
        'http_status' => $httpStatusCode
    ];
}

/**
 * Sendet eine Fehler-Response und beendet das Script
 * @param string $errorCode - Fehlercode
 * @param string $message - Fehlermeldung
 * @param string|null $detailMessage - Detaillierte Fehlermeldung
 * @param array $additionalData - Zusätzliche Daten
 * @param int $httpStatusCode - HTTP-Status-Code
 * @param Exception|null $exception - Exception-Objekt
 */
function sendErrorResponse($errorCode, $message, $detailMessage = null, $additionalData = [], $httpStatusCode = 500, $exception = null) {
    // Logge Fehler
    logError('ERROR', $message, array_merge($additionalData, ['error_code' => $errorCode]), $exception);
    
    // Erstelle Response
    $errorData = createErrorResponse($errorCode, $message, $detailMessage, $additionalData, $httpStatusCode);
    
    // Setze HTTP-Status
    http_response_code($errorData['http_status']);
    
    // Stelle sicher, dass keine Fehler vor der JSON-Ausgabe ausgegeben werden
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    // Sende JSON-Response
    echo json_encode($errorData['response'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Validiert API-Parameter und gibt strukturierte Fehler zurück
 * @param array $params - Parameter-Array
 * @param array $rules - Validierungsregeln
 * @return array|null - Fehler-Array oder null wenn valide
 */
function validateParams($params, $rules) {
    $errors = [];
    
    foreach ($rules as $param => $rule) {
        $value = isset($params[$param]) ? $params[$param] : null;
        $required = isset($rule['required']) ? $rule['required'] : false;
        $type = isset($rule['type']) ? $rule['type'] : null;
        $min = isset($rule['min']) ? $rule['min'] : null;
        $max = isset($rule['max']) ? $rule['max'] : null;
        $pattern = isset($rule['pattern']) ? $rule['pattern'] : null;
        
        // Prüfe ob erforderlich
        if ($required && ($value === null || $value === '')) {
            $errors[] = [
                'param' => $param,
                'code' => 'MISSING_PARAM',
                'message' => "Parameter '$param' ist erforderlich"
            ];
            continue;
        }
        
        // Überspringe weitere Validierung wenn Wert leer und nicht erforderlich
        if ($value === null || $value === '') {
            continue;
        }
        
        // Typ-Validierung
        if ($type !== null) {
            switch ($type) {
                case 'float':
                case 'number':
                    if (!is_numeric($value)) {
                        $errors[] = [
                            'param' => $param,
                            'code' => 'INVALID_TYPE',
                            'message' => "Parameter '$param' muss eine Zahl sein"
                        ];
                        continue 2;
                    }
                    $value = floatval($value);
                    break;
                    
                case 'int':
                case 'integer':
                    if (!is_numeric($value) || intval($value) != $value) {
                        $errors[] = [
                            'param' => $param,
                            'code' => 'INVALID_TYPE',
                            'message' => "Parameter '$param' muss eine ganze Zahl sein"
                        ];
                        continue 2;
                    }
                    break;
                    
                case 'string':
                    if (!is_string($value)) {
                        $errors[] = [
                            'param' => $param,
                            'code' => 'INVALID_TYPE',
                            'message' => "Parameter '$param' muss ein String sein"
                        ];
                        continue 2;
                    }
                    break;
            }
        }
        
        // Min/Max-Validierung
        if ($type === 'float' || $type === 'number' || $type === 'int' || $type === 'integer') {
            $numValue = floatval($value);
            if ($min !== null && $numValue < $min) {
                $errors[] = [
                    'param' => $param,
                    'code' => 'VALUE_TOO_SMALL',
                    'message' => "Parameter '$param' muss mindestens $min sein"
                ];
            }
            if ($max !== null && $numValue > $max) {
                $errors[] = [
                    'param' => $param,
                    'code' => 'VALUE_TOO_LARGE',
                    'message' => "Parameter '$param' darf maximal $max sein"
                ];
            }
        }
        
        // Pattern-Validierung
        if ($pattern !== null && !preg_match($pattern, $value)) {
            $errors[] = [
                'param' => $param,
                'code' => 'INVALID_FORMAT',
                'message' => "Parameter '$param' hat ein ungültiges Format"
            ];
        }
    }
    
    return empty($errors) ? null : $errors;
}

/**
 * Wrapper für API-Calls mit automatischem Error-Handling
 * @param callable $apiCall - Funktion die den API-Call durchführt
 * @param string $apiName - Name der API (für Fehlermeldungen)
 * @return mixed - API-Response oder null bei Fehler
 */
function executeApiCall($apiCall, $apiName = 'API') {
    try {
        return $apiCall();
    } catch (Exception $e) {
        logError('ERROR', "$apiName Call fehlgeschlagen", [
            'api_name' => $apiName,
            'exception_message' => $e->getMessage(),
            'exception_code' => $e->getCode()
        ], $e);
        return null;
    }
}

