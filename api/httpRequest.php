<?php
/**
 * HTTP Request Helper
 * 
 * Stellt HTTP-Requests mit automatischem Fallback zwischen file_get_contents und cURL bereit.
 * Funktioniert auch wenn allow_url_fopen deaktiviert ist.
 */

/**
 * Führt einen HTTP-Request durch
 * @param string $url - Die URL
 * @param array $options - Optionen (method, headers, content, timeout)
 * @return string|false - Response-String oder false bei Fehler
 */
function httpRequest($url, $options = []) {
    $method = isset($options['method']) ? strtoupper($options['method']) : 'GET';
    $headers = isset($options['headers']) ? $options['headers'] : [];
    $content = isset($options['content']) ? $options['content'] : null;
    $timeout = isset($options['timeout']) ? intval($options['timeout']) : 10;
    
    // Prüfe ob cURL verfügbar ist
    $useCurl = function_exists('curl_init');
    
    // Prüfe ob allow_url_fopen aktiviert ist
    $allowUrlFopen = ini_get('allow_url_fopen');
    
    // Verwende cURL wenn verfügbar (funktioniert auch ohne allow_url_fopen)
    // Oder wenn allow_url_fopen deaktiviert ist
    if ($useCurl && (!$allowUrlFopen || isset($options['force_curl']))) {
        return httpRequestCurl($url, $method, $headers, $content, $timeout);
    }
    
    // Fallback zu file_get_contents (nur wenn allow_url_fopen aktiviert ist)
    if ($allowUrlFopen) {
        return httpRequestFileGetContents($url, $method, $headers, $content, $timeout);
    }
    
    // Beide Methoden nicht verfügbar
    error_log('HTTP Request Fehler: Weder cURL noch allow_url_fopen verfügbar');
    return false;
}

/**
 * HTTP-Request mit cURL
 */
function httpRequestCurl($url, $method, $headers, $content, $timeout) {
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'TankCopilot/1.0 (PHP/' . PHP_VERSION . ')'
    ]);
    
    // Setze HTTP-Methode
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($content !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
        }
    } elseif ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($content !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
        }
    }
    
    // Setze Headers
    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    curl_close($ch);
    
    // Prüfe auf Fehler
    if ($response === false) {
        error_log('cURL Fehler: ' . $curlError);
        return false;
    }
    
    // Prüfe HTTP-Status-Code (4xx und 5xx sind Fehler)
    if ($httpCode >= 400) {
        error_log('HTTP Fehler: Status ' . $httpCode . ' für URL ' . $url);
        return false;
    }
    
    return $response;
}

/**
 * HTTP-Request mit file_get_contents
 */
function httpRequestFileGetContents($url, $method, $headers, $content, $timeout) {
    $contextOptions = [
        'http' => [
            'method' => $method,
            'timeout' => $timeout,
            'ignore_errors' => true
        ]
    ];
    
    // Setze Headers
    if (!empty($headers)) {
        $contextOptions['http']['header'] = $headers;
    }
    
    // Setze Content für POST/PUT/etc.
    if ($content !== null && ($method === 'POST' || $method === 'PUT' || $method === 'PATCH')) {
        $contextOptions['http']['content'] = $content;
    }
    
    $context = stream_context_create($contextOptions);
    $response = @file_get_contents($url, false, $context);
    
    return $response;
}

