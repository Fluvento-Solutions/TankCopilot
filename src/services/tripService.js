/**
 * Trip Service - GPS-Tracking für Fahrten
 * 
 * Verwaltet aktive Fahrten mit GPS-Tracking, Timer und Pause-Funktionalität.
 */

import { logInfo, logWarn, logError, logDebug } from './logService'
import { upsertTrip, getTripById } from './storageService'

// Aktive Fahrt (nur eine gleichzeitig möglich)
let activeTrip = null
let watchId = null
let timerInterval = null
let pausedTime = 0 // Gesamte Pausenzeit in ms
let pauseStartTime = null // Startzeitpunkt der aktuellen Pause

/**
 * Startet eine neue Fahrt
 * @param {Object} tripData - Fahrt-Daten (vehicleId, name, etc.)
 * @returns {Promise<Object>} - Erstellte Fahrt
 */
export async function startTrip(tripData) {
  if (activeTrip) {
    throw new Error('Es läuft bereits eine Fahrt. Bitte beenden Sie diese zuerst.')
  }

  if (!navigator.geolocation) {
    throw new Error('Geolocation wird von diesem Browser nicht unterstützt')
  }

  const trip = {
    ...tripData,
    id: tripData.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: null,
    distanceKm: 0,
    durationSeconds: 0,
    pausedDurationSeconds: 0,
    avgSpeedKmh: null,
    maxSpeedKmh: null,
    route: [], // Array von GPS-Punkten
    createdAt: tripData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Speichere initiale Fahrt
  await upsertTrip(trip)
  activeTrip = trip
  pausedTime = 0
  pauseStartTime = null

  // Starte GPS-Tracking
  startGPSTracking(trip)

  // Starte Timer
  startTimer(trip)

  logInfo('Fahrt gestartet', { tripId: trip.id })
  return trip
}

/**
 * Stoppt die aktive Fahrt
 * @returns {Promise<Object>} - Beendete Fahrt
 */
export async function stopTrip() {
  if (!activeTrip) {
    throw new Error('Keine aktive Fahrt vorhanden')
  }

  // Stoppe GPS-Tracking
  stopGPSTracking()

  // Stoppe Timer
  stopTimer()

  // Wenn pausiert, beende Pause
  if (pauseStartTime) {
    pausedTime += Date.now() - pauseStartTime
    pauseStartTime = null
  }

  const trip = {
    ...activeTrip,
    status: 'completed',
    endDate: new Date().toISOString(),
    pausedDurationSeconds: Math.round(pausedTime / 1000)
  }

  await upsertTrip(trip)
  const completedTrip = { ...trip }
  activeTrip = null
  pausedTime = 0

  logInfo('Fahrt beendet', { tripId: trip.id, distance: trip.distanceKm, duration: trip.durationSeconds })
  return completedTrip
}

/**
 * Pausiert die aktive Fahrt
 */
export async function pauseTrip() {
  if (!activeTrip) {
    throw new Error('Keine aktive Fahrt vorhanden')
  }

  if (activeTrip.status === 'paused') {
    throw new Error('Fahrt ist bereits pausiert')
  }

  // Stoppe GPS-Tracking während Pause
  stopGPSTracking()

  // Stoppe Timer
  stopTimer()

  pauseStartTime = Date.now()

  const trip = {
    ...activeTrip,
    status: 'paused'
  }

  await upsertTrip(trip)
  activeTrip = trip

  logInfo('Fahrt pausiert', { tripId: trip.id })
}

/**
 * Setzt eine pausierte Fahrt fort
 */
export async function resumeTrip() {
  if (!activeTrip) {
    throw new Error('Keine aktive Fahrt vorhanden')
  }

  if (activeTrip.status !== 'paused') {
    throw new Error('Fahrt ist nicht pausiert')
  }

  // Berechne Pausenzeit
  if (pauseStartTime) {
    pausedTime += Date.now() - pauseStartTime
    pauseStartTime = null
  }

  // Starte GPS-Tracking wieder
  startGPSTracking(activeTrip)

  // Starte Timer wieder
  startTimer(activeTrip)

  const trip = {
    ...activeTrip,
    status: 'active'
  }

  await upsertTrip(trip)
  activeTrip = trip

  logInfo('Fahrt fortgesetzt', { tripId: trip.id })
}

/**
 * Holt die aktive Fahrt
 * @returns {Object|null} - Aktive Fahrt oder null
 */
export function getActiveTrip() {
  return activeTrip
}

/**
 * Lädt eine aktive Fahrt aus dem Storage (z.B. nach App-Neustart)
 * @param {string} tripId - ID der Fahrt
 * @returns {Promise<Object|null>} - Fahrt oder null
 */
export async function loadActiveTrip(tripId) {
  const trip = await getTripById(tripId)
  
  if (trip && trip.status === 'active') {
    activeTrip = trip
    
    // Berechne Pausenzeit aus gespeicherten Daten
    pausedTime = (trip.pausedDurationSeconds || 0) * 1000
    
    // Starte Tracking und Timer
    startGPSTracking(trip)
    startTimer(trip)
    
    return trip
  } else if (trip && trip.status === 'paused') {
    activeTrip = trip
    pausedTime = (trip.pausedDurationSeconds || 0) * 1000
    pauseStartTime = Date.now() - (Date.now() - new Date(trip.updatedAt).getTime())
    
    return trip
  }
  
  return null
}

/**
 * Startet GPS-Tracking für eine Fahrt
 * @param {Object} trip - Fahrt-Objekt
 */
function startGPSTracking(trip) {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
  }

  let lastTrackTime = Date.now()
  let lastPoint = null

  const options = {
    enableHighAccuracy: true,
    timeout: 15000, // 15 Sekunden Timeout für bessere Genauigkeit
    maximumAge: 0 // Keine gecachten Positionen verwenden
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now()
      const accuracy = position.coords.accuracy

      // Nur tracken wenn Genauigkeit <= 10m und mindestens 60 Sekunden seit letztem Punkt vergangen
      if (accuracy > 10) {
        logDebug('GPS-Genauigkeit zu schlecht', { accuracy: accuracy.toFixed(0) + 'm', required: '10m' })
        return
      }

      // Prüfe ob 60 Sekunden vergangen sind
      if (now - lastTrackTime < 60000) {
        return // Noch nicht 60 Sekunden vergangen
      }

      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: accuracy,
        timestamp: new Date().toISOString(),
        speed: position.coords.speed || null, // m/s, wird zu km/h konvertiert
        heading: position.coords.heading || null
      }

      // Füge Punkt zur Route hinzu
      if (!activeTrip.route) {
        activeTrip.route = []
      }
      activeTrip.route.push(point)

      // Berechne Distanz (Haversine zwischen letztem und aktuellem Punkt)
      if (lastPoint) {
        const distance = haversineDistance(
          lastPoint.lat,
          lastPoint.lng,
          point.lat,
          point.lng
        )
        activeTrip.distanceKm += distance
      }

      // Berechne Durchschnittsgeschwindigkeit (wenn verfügbar)
      if (point.speed !== null && point.speed > 0) {
        // speed ist in m/s, konvertiere zu km/h
        const speedKmh = point.speed * 3.6
        if (!activeTrip.avgSpeedKmh) {
          activeTrip.avgSpeedKmh = speedKmh
          activeTrip.maxSpeedKmh = speedKmh
        } else {
          // Berechne Durchschnitt (gleitender Durchschnitt)
          activeTrip.avgSpeedKmh = (activeTrip.avgSpeedKmh * (activeTrip.route.length - 1) + speedKmh) / activeTrip.route.length
          if (speedKmh > activeTrip.maxSpeedKmh) {
            activeTrip.maxSpeedKmh = speedKmh
          }
        }
      }

      lastPoint = point
      lastTrackTime = now

      // Speichere nach jedem Track-Punkt
      upsertTrip(activeTrip).catch(err => {
        logError('Fehler beim Speichern der Fahrt während Tracking', { error: err.message })
      })
    },
    (error) => {
      logWarn('GPS-Fehler während Fahrt', { error: error.message, code: error.code })
    },
    options
  )
}

/**
 * Stoppt GPS-Tracking
 */
function stopGPSTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

/**
 * Startet den Timer für eine Fahrt
 * @param {Object} trip - Fahrt-Objekt
 */
function startTimer(trip) {
  if (timerInterval !== null) {
    clearInterval(timerInterval)
  }

  const startTime = new Date(trip.startDate).getTime()
  let lastPausedTime = pausedTime

  timerInterval = setInterval(() => {
    if (!activeTrip || activeTrip.status === 'paused') {
      return
    }

    const now = Date.now()
    let currentPausedTime = pausedTime
    
    // Wenn gerade pausiert, berechne aktuelle Pausenzeit
    if (pauseStartTime) {
      currentPausedTime = pausedTime + (now - pauseStartTime)
    }
    
    const elapsed = now - startTime - currentPausedTime
    activeTrip.durationSeconds = Math.max(0, Math.round(elapsed / 1000))

    // Speichere alle 30 Sekunden
    if (activeTrip.durationSeconds > 0 && activeTrip.durationSeconds % 30 === 0 && activeTrip.durationSeconds !== lastPausedTime) {
      upsertTrip(activeTrip).catch(err => {
        logError('Fehler beim Speichern der Fahrt während Timer', { error: err.message })
      })
    }
  }, 1000) // Update jede Sekunde
}

/**
 * Stoppt den Timer
 */
function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

/**
 * Berechnet die Haversine-Distanz zwischen zwei Koordinaten
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lng1 - Längengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lng2 - Längengrad Punkt 2
 * @returns {number} - Distanz in Kilometern
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
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
 * Formatiert Sekunden in lesbares Format (HH:MM:SS)
 * @param {number} seconds - Sekunden
 * @returns {string} - Formatierte Zeit im Format HH:MM:SS
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00:00'
  }
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  // Immer HH:MM:SS Format
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Formatiert Distanz in lesbares Format
 * @param {number} km - Kilometer
 * @returns {string} - Formatierte Distanz
 */
export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(2)} km`
}

