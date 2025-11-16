/**
 * Fuel Station Service - Tankstellensuche & Ersparnis-Berechnung
 * 
 * Kommuniziert mit PHP-Backend für Tankstellendaten und Routeninformationen.
 */

const API_BASE = '/TankCopilot/api'

/**
 * Sucht Tankstellen in der Nähe mit Retry-Logik und Error-Handling
 * @param {number} lat - Breitengrad
 * @param {number} lng - Längengrad
 * @param {number} radiusKm - Suchradius in km
 * @param {string} fuelType - Spritart (z.B. "e5", "e10", "diesel")
 * @param {number} maxRetries - Maximale Anzahl Wiederholungsversuche (Standard: 3)
 * @returns {Promise<{stations: Array, meta: Object}>} - Objekt mit stations Array und meta Informationen
 */
export async function searchStations(lat, lng, radiusKm = 10, fuelType = 'e5', maxRetries = 3) {
  // Validierung der Eingabeparameter
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('INVALID_COORDINATES: Ungültige Koordinaten')
  }
  
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('COORDINATES_OUT_OF_RANGE: Koordinaten außerhalb des gültigen Bereichs')
  }
  
  if (radiusKm < 0.1 || radiusKm > 25) {
    throw new Error('INVALID_RADIUS: Suchradius muss zwischen 0.1 und 25 km liegen')
  }
  
  // Normalisiere fuelType (lowercase)
  fuelType = fuelType.toLowerCase()
  
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radiusKm: Math.min(radiusKm, 25).toString(), // Max 25km
    fuelType
  })

  let lastError = null
  
  // Retry-Logik mit Exponential-Backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Timeout für Fetch (10 Sekunden)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      // Verwende absolute URL für bessere PWA-Kompatibilität
      const apiUrl = API_BASE.startsWith('http') 
        ? `${API_BASE}/fuel-prices.php?${params}`
        : `${window.location.origin}${API_BASE}/fuel-prices.php?${params}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      
      clearTimeout(timeoutId)
      
      // Detaillierte HTTP-Status-Behandlung
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorCode = 'HTTP_ERROR'
        
        if (response.status === 400) {
          errorCode = 'BAD_REQUEST'
          errorMessage = 'Ungültige Anfrage'
        } else if (response.status === 401) {
          errorCode = 'UNAUTHORIZED'
          errorMessage = 'API-Zugriff verweigert'
        } else if (response.status === 403) {
          errorCode = 'FORBIDDEN'
          errorMessage = 'Zugriff verweigert'
        } else if (response.status === 404) {
          errorCode = 'NOT_FOUND'
          errorMessage = 'API-Endpoint nicht gefunden'
        } else if (response.status === 429) {
          errorCode = 'RATE_LIMIT'
          errorMessage = 'Zu viele Anfragen. Bitte später erneut versuchen.'
        } else if (response.status >= 500) {
          errorCode = 'SERVER_ERROR'
          errorMessage = 'Server-Fehler. Bitte später erneut versuchen.'
        }
        
        // Versuche Fehler-Details aus Response zu lesen
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
          if (errorData.code) {
            errorCode = errorData.code
          }
        } catch (e) {
          // Ignoriere JSON-Parse-Fehler
        }
        
        lastError = new Error(errorMessage)
        lastError.code = errorCode
        lastError.status = response.status
        
        // Bei Client-Fehlern (4xx) nicht retryen
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw lastError
        }
        
        // Bei Server-Fehlern oder Rate-Limit: Retry
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential-Backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        throw lastError
      }

      // Parse JSON-Response
      let data
      try {
        const text = await response.text()
        data = JSON.parse(text)
      } catch (parseError) {
        throw new Error('INVALID_JSON: Ungültige JSON-Antwort von Server')
      }
      
      // Validierung der Response-Struktur
      if (!data || typeof data !== 'object') {
        throw new Error('INVALID_RESPONSE: Ungültige Antwort-Struktur')
      }
      
      // Prüfe ob Response aus Cache kommt
      const isCached = response.headers.get('X-Cache') === 'HIT'
      
      // Unterstütze sowohl alte Format (Array) als auch neues Format (Objekt mit stations)
      let stations = []
      let meta = {}
      
      if (Array.isArray(data)) {
        // Altes Format (nur Array)
        stations = data
        meta = {
          count: data.length,
          isMock: data.some(s => s.isMock === true),
          timestamp: new Date().toISOString(),
          isCached: isCached
        }
      } else if (data.stations && Array.isArray(data.stations)) {
        // Neues Format (Objekt mit stations und meta)
        stations = data.stations
        meta = {
          ...(data.meta || {}),
          isCached: isCached
        }
      } else {
        throw new Error('INVALID_RESPONSE: Antwort enthält keine Stationen')
      }
      
      // Validierung jeder Station
      const validatedStations = stations.filter(station => {
        return station &&
               typeof station === 'object' &&
               typeof station.lat === 'number' &&
               typeof station.lng === 'number' &&
               typeof station.pricePerLiter === 'number' &&
               !isNaN(station.lat) &&
               !isNaN(station.lng) &&
               !isNaN(station.pricePerLiter) &&
               station.lat >= -90 && station.lat <= 90 &&
               station.lng >= -180 && station.lng <= 180
      })
      
      if (validatedStations.length === 0 && stations.length > 0) {
        throw new Error('INVALID_DATA: Keine gültigen Stationen in der Antwort')
      }
      
      return {
        stations: validatedStations,
        meta: {
          ...meta,
          count: validatedStations.length,
          validated: true
        }
      }
      
    } catch (error) {
      lastError = error
      
      // Bei Netzwerk-Fehlern: Retry
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      // Bei anderen Fehlern: Nicht retryen
      if (attempt === maxRetries - 1) {
        // Letzter Versuch fehlgeschlagen
        const finalError = new Error(
          error.message || 'Tankstellensuche fehlgeschlagen'
        )
        finalError.code = error.code || 'UNKNOWN_ERROR'
        finalError.originalError = error
        throw finalError
      }
    }
  }
  
  // Sollte nie erreicht werden, aber für TypeScript/Sicherheit
  throw lastError || new Error('Tankstellensuche fehlgeschlagen')
}

/**
 * Holt Distanz und Fahrzeit zwischen zwei Punkten mit Retry-Logik
 * @param {number} fromLat - Start-Breitengrad
 * @param {number} fromLng - Start-Längengrad
 * @param {number} toLat - Ziel-Breitengrad
 * @param {number} toLng - Ziel-Längengrad
 * @param {number} maxRetries - Maximale Anzahl Wiederholungsversuche (Standard: 2)
 * @returns {Promise<{distanceKm: number, durationMinutes: number}>}
 */
export async function getRouteDistance(fromLat, fromLng, toLat, toLng, maxRetries = 2) {
  // Validierung
  if (typeof fromLat !== 'number' || typeof fromLng !== 'number' || 
      typeof toLat !== 'number' || typeof toLng !== 'number' ||
      isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    throw new Error('INVALID_COORDINATES: Ungültige Koordinaten')
  }
  
  const params = new URLSearchParams({
    fromLat: fromLat.toString(),
    fromLng: fromLng.toString(),
    toLat: toLat.toString(),
    toLng: toLng.toString()
  })

  let lastError = null
  
  // Retry-Logik
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 Sekunden Timeout
      
      // Verwende absolute URL für bessere PWA-Kompatibilität
      const apiUrl = API_BASE.startsWith('http')
        ? `${API_BASE}/route-distance.php?${params}`
        : `${window.location.origin}${API_BASE}/route-distance.php?${params}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorCode = 'HTTP_ERROR'
        
        if (response.status === 400) {
          errorCode = 'BAD_REQUEST'
          errorMessage = 'Ungültige Anfrage'
        } else if (response.status >= 500) {
          errorCode = 'SERVER_ERROR'
          errorMessage = 'Server-Fehler'
        }
        
        // Versuche Fehler-Details zu lesen
        try {
          const errorData = await response.json()
          if (errorData.error) errorMessage = errorData.error
          if (errorData.code) errorCode = errorData.code
        } catch (e) {
          // Ignoriere JSON-Parse-Fehler
        }
        
        lastError = new Error(errorMessage)
        lastError.code = errorCode
        lastError.status = response.status
        
        // Bei Client-Fehlern nicht retryen
        if (response.status >= 400 && response.status < 500) {
          throw lastError
        }
        
        // Bei Server-Fehlern: Retry
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        throw lastError
      }

      // Parse JSON
      let data
      try {
        const text = await response.text()
        data = JSON.parse(text)
      } catch (parseError) {
        throw new Error('INVALID_JSON: Ungültige JSON-Antwort')
      }
      
      // Validierung
      if (!data || typeof data !== 'object') {
        throw new Error('INVALID_RESPONSE: Ungültige Antwort-Struktur')
      }
      
      const distanceKm = typeof data.distanceKm === 'number' ? data.distanceKm : 0
      const durationMinutes = typeof data.durationMinutes === 'number' ? data.durationMinutes : 0
      
      if (isNaN(distanceKm) || isNaN(durationMinutes) || distanceKm < 0 || durationMinutes < 0) {
        throw new Error('INVALID_DATA: Ungültige Distanz- oder Zeitwerte')
      }
      
      return {
        distanceKm: Math.round(distanceKm * 100) / 100, // 2 Dezimalstellen
        durationMinutes: Math.round(durationMinutes)
      }
      
    } catch (error) {
      lastError = error
      
      // Bei Netzwerk-Fehlern: Retry
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      // Bei anderen Fehlern: Nicht retryen
      if (attempt === maxRetries - 1) {
        const finalError = new Error(
          error.message || 'Routenberechnung fehlgeschlagen'
        )
        finalError.code = error.code || 'UNKNOWN_ERROR'
        throw finalError
      }
    }
  }
  
  throw lastError || new Error('Routenberechnung fehlgeschlagen')
}

/**
 * Berechnet für jede Station die Kosten und Ersparnis (inkl. Hin- und Rückfahrt)
 * @param {Array} stations - Array von Station-Objekten (mit distanceKm und durationMinutes)
 * @param {Object} vehicle - Fahrzeug-Objekt (mit avgConsumptionLPer100km)
 * @param {number} fuelLevelPercent - Aktueller Tankfüllstand in Prozent (0-100)
 * @returns {Array} - Stationen mit zusätzlichen Feldern:
 *   - costAtStation: Kosten für das Tanken an dieser Station
 *   - roundTripDistanceKm: Gesamtdistanz Hin- und Rückfahrt (2x distanceKm)
 *   - roundTripFuelConsumptionLiters: Spritverbrauch für Hin- und Rückfahrt
 *   - roundTripCost: Kosten für Hin- und Rückfahrt (berechnet mit Preis der Referenzstation)
 *   - netSavingComparedToRef: Netto-Ersparnis (Ersparnis beim Tanken - Fahrtkosten)
 */
export function calculateStationSavings(stations, vehicle, fuelLevelPercent) {
  if (!vehicle || !vehicle.tankCapacityLiters || stations.length === 0) {
    return stations
  }

  // Berechne aktuelle Tankfüllung und nachfüllbare Menge
  const currentFuelLiters = vehicle.tankCapacityLiters * (fuelLevelPercent / 100)
  const refillLiters = vehicle.tankCapacityLiters - currentFuelLiters

  // Hole Verbrauch des Fahrzeugs (L/100km)
  // Priorität: 1. Berechneter Durchschnittsverbrauch (aus echten Daten)
  //           2. Geschätzter Verbrauch (vom Benutzer eingegeben)
  //           3. Fallback: 7.5 L/100km
  const consumptionLitersPer100km = vehicle.avgConsumptionLPer100km || vehicle.estimatedConsumptionLPer100km || 7.5

  if (refillLiters <= 0) {
    return stations.map(station => ({
      ...station,
      costAtStation: 0,
      roundTripDistanceKm: (station.distanceKm || 0) * 2,
      roundTripFuelConsumptionLiters: 0,
      roundTripCost: 0,
      netSavingComparedToRef: 0,
      savingComparedToRef: 0
    }))
  }

  // Finde Referenzstation (geringste Distanz)
  const referenceStation = stations.reduce((min, station) => {
    return (!min || station.distanceKm < min.distanceKm) ? station : min
  }, null)

  if (!referenceStation) {
    return stations
  }

  const refPricePerLiter = referenceStation.pricePerLiter
  const costAtRef = refillLiters * refPricePerLiter

  // Berechne Fahrtkosten zur Referenzstation (Hin- und Rückfahrt)
  const refRoundTripDistanceKm = referenceStation.distanceKm * 2
  const refRoundTripFuelConsumptionLiters = (refRoundTripDistanceKm / 100) * consumptionLitersPer100km
  const refRoundTripCost = refRoundTripFuelConsumptionLiters * refPricePerLiter

  // Berechne für jede Station Kosten und Ersparnis
  return stations.map(station => {
    // Kosten für das Tanken an dieser Station
    const costAtStation = refillLiters * station.pricePerLiter
    
    // Hin- und Rückfahrt zur Station
    const roundTripDistanceKm = (station.distanceKm || 0) * 2
    
    // Spritverbrauch für Hin- und Rückfahrt
    const roundTripFuelConsumptionLiters = (roundTripDistanceKm / 100) * consumptionLitersPer100km
    
    // Fahrtkosten (berechnet mit dem Preis der Referenzstation - das ist der aktuelle Marktpreis)
    // Die Fahrt erfolgt mit dem bereits im Tank befindlichen Sprit, daher verwenden wir den Referenzpreis
    const roundTripCost = roundTripFuelConsumptionLiters * refPricePerLiter
    
    // Brutto-Ersparnis beim Tanken (ohne Fahrtkosten)
    const grossSaving = costAtRef - costAtStation
    
    // Netto-Ersparnis (Ersparnis beim Tanken - zusätzliche Fahrtkosten im Vergleich zur Referenzstation)
    // Wenn diese Station weiter weg ist, müssen wir die zusätzlichen Fahrtkosten abziehen
    const additionalRoundTripDistanceKm = roundTripDistanceKm - refRoundTripDistanceKm
    const additionalRoundTripFuelConsumptionLiters = (additionalRoundTripDistanceKm / 100) * consumptionLitersPer100km
    // Zusätzliche Fahrtkosten mit Referenzpreis berechnen (Fahrt erfolgt mit bereits vorhandenem Sprit)
    const additionalRoundTripCost = additionalRoundTripFuelConsumptionLiters * refPricePerLiter
    
    // Netto-Ersparnis = Brutto-Ersparnis - zusätzliche Fahrtkosten
    const netSavingComparedToRef = grossSaving - additionalRoundTripCost

    return {
      ...station,
      costAtStation: Math.round(costAtStation * 100) / 100,
      roundTripDistanceKm: Math.round(roundTripDistanceKm * 100) / 100,
      roundTripFuelConsumptionLiters: Math.round(roundTripFuelConsumptionLiters * 1000) / 1000, // 3 Dezimalstellen
      roundTripCost: Math.round(roundTripCost * 100) / 100,
      netSavingComparedToRef: Math.round(netSavingComparedToRef * 100) / 100,
      // Behalte alte Felder für Kompatibilität
      savingComparedToRef: Math.round(grossSaving * 100) / 100
    }
  })
}

/**
 * Holt für alle Stationen die Routeninformationen
 * @param {Array} stations - Array von Station-Objekten (ohne distanceKm/durationMinutes)
 * @param {number} userLat - Nutzer-Breitengrad
 * @param {number} userLng - Nutzer-Längengrad
 * @returns {Promise<Array>} - Stationen mit distanceKm und durationMinutes
 */
export async function enrichStationsWithRoutes(stations, userLat, userLng) {
  const enrichedStations = await Promise.all(
    stations.map(async (station) => {
      try {
        const route = await getRouteDistance(userLat, userLng, station.lat, station.lng)
        return {
          ...station,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes
        }
      } catch (error) {
        logError(`Fehler bei Route zu Station ${station.id}`, { error: error.message, stationId: station.id })
        // Fallback: Haversine-Distanz approximieren
        const approxDistance = calculateHaversineDistance(userLat, userLng, station.lat, station.lng)
        return {
          ...station,
          distanceKm: approxDistance,
          durationMinutes: Math.round((approxDistance / 50) * 60) // 50 km/h Durchschnitt
        }
      }
    })
  )

  return enrichedStations
}

/**
 * Berechnet die Haversine-Distanz zwischen zwei Punkten (Fallback)
 * @param {number} lat1 - Breitengrad 1
 * @param {number} lng1 - Längengrad 1
 * @param {number} lat2 - Breitengrad 2
 * @param {number} lng2 - Längengrad 2
 * @returns {number} - Distanz in km
 */
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Erdradius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Formatiert die Adresse einer Tankstelle
 * Format: "Straße Hausnummer, Ortsname" (erster Buchstabe groß)
 * @param {Object} station - Station-Objekt mit street, postalCode, city
 * @returns {string|null} - Formatierte Adresse oder null wenn nicht verfügbar
 */
export function formatStationAddress(station) {
  if (!station) return null
  
  const parts = []
  
  // Straße (mit Hausnummer falls vorhanden)
  if (station.street) {
    // Stelle sicher, dass erster Buchstabe groß ist, Rest bleibt unverändert
    const street = station.street.trim()
    const formattedStreet = street.charAt(0).toUpperCase() + street.slice(1)
    parts.push(formattedStreet)
  }
  
  // Ortsname (ohne PLZ, erster Buchstabe groß)
  if (station.city) {
    const city = station.city.trim()
    // Stelle sicher, dass erster Buchstabe groß ist, Rest bleibt unverändert
    const formattedCity = city.charAt(0).toUpperCase() + city.slice(1)
    parts.push(formattedCity)
  }
  
  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Erstellt eine Navigation URL mit Adresse oder Koordinaten als Fallback
 * @param {Object} station - Station-Objekt mit Adressdaten und Koordinaten
 * @param {string} appName - Name der Navigations-App (optional)
 * @returns {string} - Navigation URL
 */
/**
 * Reverse Geocoding - Konvertiert Koordinaten zu einer Adresse
 * @param {number} lat - Breitengrad
 * @param {number} lng - Längengrad
 * @returns {Promise<string|null>} - Adresse oder null bei Fehler
 */
/**
 * Reverse Geocoding: Konvertiert Koordinaten zu einer Adresse
 * @param {number} lat - Breitengrad
 * @param {number} lng - Längengrad
 * @returns {Promise<string|null>} - Adresse oder null bei Fehler
 */
export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString()
    })
    
    const apiUrl = API_BASE.startsWith('http')
      ? `${API_BASE}/reverse-geocode.php?${params}`
      : `${window.location.origin}${API_BASE}/reverse-geocode.php?${params}`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(5000) // 5 Sekunden Timeout
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.address || null
  } catch (error) {
    logWarn('Reverse Geocoding fehlgeschlagen', { error: error.message })
    return null
  }
}

/**
 * Geocoding: Konvertiert eine Adresse zu Koordinaten
 * @param {string|Object} addressOrParts - Adresse als String oder Objekt mit {address, street, postalCode, city}
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}|null>} - Koordinaten und formatierte Adresse oder null bei Fehler
 */
export async function geocode(addressOrParts) {
  try {
    const params = new URLSearchParams()
    
    if (typeof addressOrParts === 'string') {
      params.append('address', addressOrParts)
    } else if (typeof addressOrParts === 'object') {
      if (addressOrParts.address) {
        params.append('address', addressOrParts.address)
      } else {
        if (addressOrParts.street) params.append('street', addressOrParts.street)
        if (addressOrParts.postalCode) params.append('postalCode', addressOrParts.postalCode)
        if (addressOrParts.city) params.append('city', addressOrParts.city)
      }
    } else {
      throw new Error('Ungültiger Parameter: addressOrParts muss String oder Objekt sein')
    }
    
    const apiUrl = API_BASE.startsWith('http')
      ? `${API_BASE}/geocode.php?${params}`
      : `${window.location.origin}${API_BASE}/geocode.php?${params}`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(5000) // 5 Sekunden Timeout
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data.coordinates && typeof data.coordinates.lat === 'number' && typeof data.coordinates.lng === 'number') {
      return {
        lat: data.coordinates.lat,
        lng: data.coordinates.lng,
        formattedAddress: data.formattedAddress || null
      }
    }
    
    return null
  } catch (error) {
    logWarn('Geocoding fehlgeschlagen', { error: error.message })
    return null
  }
}

export function getNavigationUrl(station, appName = null) {
  if (!station) return ''
  
  // Versuche zuerst Adresse zu verwenden
  const address = formatStationAddress(station)
  
  // Wenn App-Name angegeben, verwende spezifische Funktion
  if (appName && appName !== 'auto') {
    return getNavigationUrlForApp(appName, station, address)
  }
  
  // Automatische Plattform-Erkennung
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(navigator.userAgent)
  
  if (isIOS) {
    return getNavigationUrlForApp('apple', station, address)
  } else if (isAndroid) {
    return getNavigationUrlForApp('google', station, address)
  } else {
    // Fallback: Google Maps Web
    return getNavigationUrlForApp('google', station, address)
  }
}

/**
 * Erstellt eine Navigation URL für eine spezifische App
 * @param {string} appName - Name der App ('apple', 'google', 'waze', 'osmand')
 * @param {Object} station - Station-Objekt
 * @param {string|null} address - Formatierte Adresse (optional, wird automatisch erstellt wenn nicht vorhanden)
 * @returns {string} - Navigation URL
 */
export function getNavigationUrlForApp(appName, station, address = null) {
  if (!station) return ''
  
  // Adresse formatieren falls nicht vorhanden
  if (!address) {
    address = formatStationAddress(station)
  }
  
  // Fallback zu Koordinaten wenn keine Adresse
  const hasAddress = address && address.trim().length > 0
  const preciseLat = station.lat ? station.lat.toFixed(7) : ''
  const preciseLng = station.lng ? station.lng.toFixed(7) : ''
  
  switch (appName) {
    case 'apple':
      if (hasAddress) {
        return `maps://?daddr=${encodeURIComponent(address)}&dirflg=d`
      } else if (preciseLat && preciseLng) {
        return `maps://?daddr=${preciseLat},${preciseLng}&dirflg=d`
      }
      break
      
    case 'google':
      if (hasAddress) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      } else if (preciseLat && preciseLng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${preciseLat},${preciseLng}`
      }
      break
      
    case 'waze':
      if (hasAddress) {
        return `https://waze.com/ul?q=${encodeURIComponent(address)}`
      } else if (preciseLat && preciseLng) {
        return `https://waze.com/ul?q=${preciseLat},${preciseLng}`
      }
      break
      
    case 'osmand':
      if (hasAddress) {
        return `osmand.navigation:q=${encodeURIComponent(address)}`
      } else if (preciseLat && preciseLng) {
        return `osmand.navigation:q=${preciseLat},${preciseLng}`
      }
      break
      
    default:
      // Fallback zu Google Maps
      if (hasAddress) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      } else if (preciseLat && preciseLng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${preciseLat},${preciseLng}`
      }
  }
  
  return ''
}

