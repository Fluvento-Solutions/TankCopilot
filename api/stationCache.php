<?php
/**
 * Station Cache Manager
 * 
 * Verwaltet gecachte Tankstellen-Positionen.
 * Positionen ändern sich nicht, nur Preise und Öffnungszeiten müssen aktualisiert werden.
 */

class StationCache {
    private $cacheDir;
    private $cacheFile;
    private $cacheExpiry = 86400; // 24 Stunden für Positionen
    
    public function __construct() {
        $this->cacheDir = dirname(__DIR__) . '/cache/stations';
        $this->cacheFile = $this->cacheDir . '/stations.json';
        
        // Stelle sicher, dass Cache-Verzeichnis existiert
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0755, true);
        }
    }
    
    /**
     * Lädt gecachte Stationen für einen Bereich
     * @param float $lat - Breitengrad
     * @param float $lng - Längengrad
     * @param float $radiusKm - Radius in km
     * @return array|null - Array von Stationen oder null wenn nicht im Cache
     */
    public function getCachedStations($lat, $lng, $radiusKm) {
        if (!file_exists($this->cacheFile)) {
            return null;
        }
        
        $cacheData = @json_decode(file_get_contents($this->cacheFile), true);
        if (!$cacheData || !isset($cacheData['stations']) || !isset($cacheData['timestamp'])) {
            return null;
        }
        
        // Prüfe ob Cache abgelaufen ist
        if (time() - $cacheData['timestamp'] > $this->cacheExpiry) {
            return null;
        }
        
        // Filtere Stationen im Radius
        $cachedStations = [];
        foreach ($cacheData['stations'] as $station) {
            if (!isset($station['lat']) || !isset($station['lng'])) {
                continue;
            }
            
            $distance = $this->haversineDistance($lat, $lng, $station['lat'], $station['lng']);
            if ($distance <= $radiusKm) {
                $cachedStations[] = $station;
            }
        }
        
        return !empty($cachedStations) ? $cachedStations : null;
    }
    
    /**
     * Speichert Stationen im Cache
     * @param array $stations - Array von Stationen
     */
    public function saveStations($stations) {
        $cacheData = [
            'timestamp' => time(),
            'stations' => $stations
        ];
        
        // Lade bestehenden Cache und merge
        $existingCache = null;
        if (file_exists($this->cacheFile)) {
            $existingData = @json_decode(file_get_contents($this->cacheFile), true);
            if ($existingData && isset($existingData['stations']) && is_array($existingData['stations']) && time() - $existingData['timestamp'] < $this->cacheExpiry) {
                $existingCache = $existingData['stations'];
            }
        }
        
        // Merge: Aktualisiere bestehende Stationen oder füge neue hinzu
        if ($existingCache !== null) {
            $stationMap = [];
            foreach ($existingCache as $station) {
                if (isset($station['id'])) {
                    $stationMap[$station['id']] = $station;
                }
            }
            
            // Aktualisiere mit neuen Daten
            foreach ($stations as $station) {
                if (isset($station['id'])) {
                    // Wenn Station bereits existiert, aktualisiere nur Preis/Öffnungszeiten
                    if (isset($stationMap[$station['id']])) {
                        $stationMap[$station['id']]['pricePerLiter'] = $station['pricePerLiter'];
                        $stationMap[$station['id']]['isSB'] = $station['isSB'];
                        $stationMap[$station['id']]['lastUpdate'] = $station['lastUpdate'];
                        $stationMap[$station['id']]['isMock'] = $station['isMock'] ?? false;
                    } else {
                        // Neue Station hinzufügen
                        $stationMap[$station['id']] = $station;
                    }
                }
            }
            
            $cacheData['stations'] = array_values($stationMap);
        } else {
            $cacheData['stations'] = $stations;
        }
        
        @file_put_contents($this->cacheFile, json_encode($cacheData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }
    
    /**
     * Aktualisiert nur Preise und Öffnungszeiten für gecachte Stationen
     * @param array $priceUpdates - Array mit id => {pricePerLiter, isSB, lastUpdate}
     */
    public function updatePrices($priceUpdates) {
        if (!file_exists($this->cacheFile)) {
            return;
        }
        
        $cacheData = @json_decode(file_get_contents($this->cacheFile), true);
        if (!$cacheData || !isset($cacheData['stations'])) {
            return;
        }
        
        $updated = false;
        foreach ($cacheData['stations'] as &$station) {
            if (isset($station['id']) && isset($priceUpdates[$station['id']])) {
                $update = $priceUpdates[$station['id']];
                $station['pricePerLiter'] = $update['pricePerLiter'];
                $station['isSB'] = $update['isSB'];
                $station['lastUpdate'] = $update['lastUpdate'];
                $station['isMock'] = $update['isMock'] ?? false;
                $updated = true;
            }
        }
        
        if ($updated) {
            $cacheData['timestamp'] = time();
            @file_put_contents($this->cacheFile, json_encode($cacheData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        }
    }
    
    /**
     * Berechnet Haversine-Distanz zwischen zwei Punkten
     */
    private function haversineDistance($lat1, $lng1, $lat2, $lng2) {
        $earthRadius = 6371; // km
        
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);
        
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        
        return $earthRadius * $c;
    }
    
    /**
     * Löscht den Cache
     */
    public function clearCache() {
        if (file_exists($this->cacheFile)) {
            @unlink($this->cacheFile);
        }
    }
    
    /**
     * Gibt Cache-Statistiken zurück
     */
    public function getCacheStats() {
        if (!file_exists($this->cacheFile)) {
            return [
                'exists' => false,
                'station_count' => 0,
                'age_hours' => 0
            ];
        }
        
        $cacheData = @json_decode(file_get_contents($this->cacheFile), true);
        if (!$cacheData) {
            return [
                'exists' => true,
                'station_count' => 0,
                'age_hours' => 0,
                'corrupted' => true
            ];
        }
        
        return [
            'exists' => true,
            'station_count' => isset($cacheData['stations']) ? count($cacheData['stations']) : 0,
            'age_hours' => isset($cacheData['timestamp']) ? round((time() - $cacheData['timestamp']) / 3600, 2) : 0,
            'timestamp' => isset($cacheData['timestamp']) ? date('Y-m-d H:i:s', $cacheData['timestamp']) : null
        ];
    }
}

