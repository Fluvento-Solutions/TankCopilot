/**
 * Geo Service - Geolocation Handling
 * 
 * Nutzt das Geolocation-API des Browsers nur auf explizite User-Aktion.
 * Keine dauerhafte Standortverfolgung.
 */

import { logInfo, logWarn, logError, logDebug } from './logService'

/**
 * Holt die aktuelle Position des Nutzers mit verbesserter Genauigkeit für iOS
 * @param {Object} options - Optionen für Geolocation
 * @param {number} maxAttempts - Maximale Anzahl Versuche (Standard: 3)
 * @returns {Promise<{lat: number, lng: number, accuracy?: number}>}
 */
export function getCurrentLocation(options = {}, maxAttempts = 3) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation wird von diesem Browser nicht unterstützt'))
      return
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 60000, // 60 Sekunden für höchste GPS-Genauigkeit (Hausnummern)
      maximumAge: 0 // Keine gecachte Position verwenden
    }

    const geoOptions = { ...defaultOptions, ...options }
    let attempts = 0
    let watchId = null

    const tryGetPosition = () => {
      attempts++
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          // Logging für Debugging
          logDebug(`GPS-Versuch ${attempts}`, { accuracy: accuracy.toFixed(0), lat, lng })
          
          // Wenn Genauigkeit besser als 50m (für Hausnummern) oder letzter Versuch, akzeptieren
          if (accuracy <= 50 || attempts >= maxAttempts) {
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId)
            }
            resolve({
              lat,
              lng,
              accuracy
            })
            return
          }
          
          // Wenn Genauigkeit schlechter als 50m und noch Versuche übrig, erneut versuchen
          logWarn(`Genauigkeit ${accuracy.toFixed(0)}m zu schlecht (Ziel: <= 50m für Hausnummern), versuche erneut...`, { attempts, maxAttempts })
          setTimeout(() => {
            tryGetPosition()
          }, 2000) // 2 Sekunden warten vor nächstem Versuch
        },
        (error) => {
          // Bei Fehler: Versuche watchPosition als Fallback (nur beim letzten Versuch)
          if (attempts < maxAttempts) {
            logWarn(`Versuch ${attempts} fehlgeschlagen, versuche erneut...`, { attempts, maxAttempts })
            setTimeout(() => {
              tryGetPosition()
            }, 2000)
            return
          }
          
          // Letzter Versuch: Nutze watchPosition als Fallback
          if (attempts === maxAttempts && watchId === null) {
            logInfo('Nutze watchPosition als Fallback...', { attempts, maxAttempts })
            watchId = navigator.geolocation.watchPosition(
              (position) => {
                const accuracy = position.coords.accuracy
                const lat = position.coords.latitude
                const lng = position.coords.longitude
                
                logInfo(`watchPosition: Genauigkeit ${accuracy.toFixed(0)}m`, { accuracy, lat, lng })
                
                // Akzeptiere erste brauchbare Position (auch wenn > 100m)
                navigator.geolocation.clearWatch(watchId)
                resolve({
                  lat,
                  lng,
                  accuracy
                })
              },
              (watchError) => {
                navigator.geolocation.clearWatch(watchId)
                handleError(watchError)
              },
              geoOptions
            )
            
            // Timeout für watchPosition
            setTimeout(() => {
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
                handleError({ code: 3, message: 'Timeout' })
              }
            }, geoOptions.timeout)
            return
          }
          
          handleError(error)
        },
        geoOptions
      )
    }

    const handleError = (error) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      
      let errorMessage = 'Standort konnte nicht ermittelt werden'
      
      if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
        errorMessage = 'Standortzugriff wurde verweigert. Bitte aktivieren Sie die Geolocation in den Einstellungen.'
      } else if (error.code === 2 || error.code === error.POSITION_UNAVAILABLE) {
        errorMessage = 'Standortinformationen sind nicht verfügbar.'
      } else if (error.code === 3 || error.code === error.TIMEOUT) {
        errorMessage = 'Zeitüberschreitung beim Abrufen des Standorts. Bitte versuchen Sie es erneut.'
      } else {
        errorMessage = 'Unbekannter Fehler beim Abrufen des Standorts.'
      }
      
      reject(new Error(errorMessage))
    }

    // Starte ersten Versuch
    tryGetPosition()
  })
}

/**
 * Prüft ob Geolocation erlaubt ist
 * @returns {Promise<boolean>}
 */
export async function checkGeolocationPermission() {
  if (!navigator.permissions) {
    // Fallback: Versuche Position abzurufen (wird sofort abgelehnt wenn nicht erlaubt)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 100 }
      )
    })
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state === 'granted'
  } catch (error) {
    logWarn('Permission API nicht verfügbar', { error: error.message })
    return true // Optimistisch annehmen
  }
}

/**
 * Erweiterte getCurrentLocation mit Fallbacks:
 * 1. GPS mit hoher Genauigkeit (<= 500m)
 * 2. Niedrigere Genauigkeit akzeptieren (Funkmast/WLAN, <= 5000m)
 * 3. Reject mit speziellem Fehler für manuelle Eingabe
 * @param {Object} options - Optionen für Geolocation
 * @param {number} maxAttempts - Maximale Anzahl Versuche (Standard: 3)
 * @returns {Promise<{lat: number, lng: number, accuracy?: number, source?: string}>}
 */
export function getCurrentLocationWithFallbacks(options = {}, maxAttempts = 3) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_NOT_SUPPORTED'))
      return
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 60000, // 60 Sekunden für höchste GPS-Genauigkeit (Hausnummern)
      maximumAge: 0 // Keine gecachte Position verwenden
    }

    const geoOptions = { ...defaultOptions, ...options }
    let attempts = 0
    let watchId = null
    let fallbackAttempted = false

    const tryGetPosition = (acceptLowerAccuracy = false) => {
      attempts++
      
      // Bei Fallback: niedrigere Genauigkeit akzeptieren
      const currentOptions = acceptLowerAccuracy 
        ? { ...geoOptions, enableHighAccuracy: false }
        : geoOptions
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          logDebug(`GPS-Versuch ${attempts}${acceptLowerAccuracy ? ' (Fallback)' : ''}`, { 
            accuracy: accuracy.toFixed(0), 
            lat, 
            lng,
            source: acceptLowerAccuracy ? 'cell/wifi' : 'gps'
          })
          
          // Wenn Genauigkeit akzeptabel oder letzter Versuch
          // Für Hausnummern: Zielgenauigkeit 50m, Fallback akzeptiert bis 500m
          const accuracyThreshold = acceptLowerAccuracy ? 5000 : 50
          if (accuracy <= accuracyThreshold || attempts >= maxAttempts) {
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId)
            }
            resolve({
              lat,
              lng,
              accuracy,
              source: acceptLowerAccuracy ? 'cell/wifi' : 'gps'
            })
            return
          }
          
          // Wenn Genauigkeit schlecht und noch Versuche übrig
          logWarn(`Genauigkeit ${accuracy.toFixed(0)}m zu schlecht (Ziel: <= ${accuracyThreshold}m), versuche erneut...`, { 
            attempts, 
            maxAttempts,
            acceptLowerAccuracy 
          })
          setTimeout(() => {
            tryGetPosition(acceptLowerAccuracy)
          }, 2000)
        },
        (error) => {
          // Bei Fehler: Versuche Fallback oder watchPosition
          if (attempts < maxAttempts && !acceptLowerAccuracy && !fallbackAttempted) {
            // Versuche Fallback mit niedrigerer Genauigkeit
            fallbackAttempted = true
            logInfo('GPS fehlgeschlagen, versuche Fallback (Funkmast/WLAN)...', { attempts })
            setTimeout(() => {
              tryGetPosition(true) // Fallback mit niedrigerer Genauigkeit
            }, 2000)
            return
          }
          
          if (attempts < maxAttempts && !acceptLowerAccuracy) {
            logWarn(`Versuch ${attempts} fehlgeschlagen, versuche erneut...`, { attempts, maxAttempts })
            setTimeout(() => {
              tryGetPosition()
            }, 2000)
            return
          }
          
          // Letzter Versuch: Nutze watchPosition als Fallback
          if (attempts === maxAttempts && watchId === null) {
            logInfo('Nutze watchPosition als Fallback...', { attempts, maxAttempts })
            watchId = navigator.geolocation.watchPosition(
              (position) => {
                const accuracy = position.coords.accuracy
                const lat = position.coords.latitude
                const lng = position.coords.longitude
                
                logInfo(`watchPosition: Genauigkeit ${accuracy.toFixed(0)}m`, { accuracy, lat, lng })
                
                navigator.geolocation.clearWatch(watchId)
                resolve({
                  lat,
                  lng,
                  accuracy,
                  source: 'watch'
                })
              },
              (watchError) => {
                navigator.geolocation.clearWatch(watchId)
                handleError(watchError)
              },
              acceptLowerAccuracy ? { ...geoOptions, enableHighAccuracy: false } : geoOptions
            )
            
            setTimeout(() => {
              if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
                handleError({ code: 3, message: 'Timeout' })
              }
            }, geoOptions.timeout)
            return
          }
          
          handleError(error)
        },
        currentOptions
      )
    }

    const handleError = (error) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      
      let errorCode = 'UNKNOWN_ERROR'
      let userMessage = 'Standort konnte nicht ermittelt werden'
      
      // iOS-spezifische Fehlermeldungen
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      
      if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
        errorCode = 'PERMISSION_DENIED'
        userMessage = isIOS 
          ? 'Standortzugriff wurde verweigert. Bitte aktivieren Sie die Standortfreigabe in den iOS-Einstellungen: Einstellungen > Datenschutz > Standortdienste > Safari.'
          : 'Standortzugriff wurde verweigert. Bitte aktivieren Sie die Geolocation in den Browser-Einstellungen.'
      } else if (error.code === 2 || error.code === error.POSITION_UNAVAILABLE) {
        errorCode = 'POSITION_UNAVAILABLE'
        userMessage = isIOS
          ? 'Standortinformationen sind nicht verfügbar. Bitte stellen Sie sicher, dass GPS aktiviert ist und Sie sich im Freien befinden.'
          : 'Standortinformationen sind nicht verfügbar.'
      } else if (error.code === 3 || error.code === error.TIMEOUT) {
        errorCode = 'TIMEOUT'
        userMessage = isIOS
          ? 'Zeitüberschreitung beim Abrufen des Standorts. Bitte stellen Sie sicher, dass GPS aktiviert ist und versuchen Sie es erneut.'
          : 'Zeitüberschreitung beim Abrufen des Standorts. Bitte versuchen Sie es erneut.'
      }
      
      logError('Geolocation fehlgeschlagen', { 
        errorCode, 
        error: error.message,
        isIOS,
        userAgent: navigator.userAgent
      })
      
      const finalError = new Error(errorCode)
      finalError.userMessage = userMessage
      reject(finalError)
    }

    // Starte ersten Versuch
    tryGetPosition()
  })
}

