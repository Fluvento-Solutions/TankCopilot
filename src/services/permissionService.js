/**
 * Permission Service - Berechtigungsverwaltung
 * 
 * Verwaltet Berechtigungen für Standort und Benachrichtigungen
 * Unterstützt iOS und Android
 */

import { logInfo, logWarn, logError } from './logService'

/**
 * Erkennt die Plattform (iOS, Android, Desktop)
 */
export function detectPlatform() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  // iOS Erkennung
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  // Android Erkennung
  const isAndroid = /Android/.test(ua)
  
  return {
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid,
    isDesktop: !isIOS && !isAndroid
  }
}

/**
 * Prüft den Status der Standortberechtigung
 * @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>}
 */
export async function checkLocationPermission() {
  if (!navigator.geolocation) {
    return 'unsupported'
  }
  
  // Permissions API ist nicht überall verfügbar (besonders iOS Safari)
  if ('permissions' in navigator && 'query' in navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state // 'granted', 'denied', 'prompt'
    } catch (error) {
      logWarn('Permissions API nicht verfügbar, verwende Fallback', { error: error.message })
      // Fallback: Verwende Notification.permission-ähnliches Verhalten
      // Keine Geolocation-Aufrufe, um Permissions Policy Verletzungen zu vermeiden
      return 'prompt' // Sicherheitshalber 'prompt' zurückgeben
    }
  } else {
    // Fallback für Browser ohne Permissions API (z.B. iOS Safari)
    // Keine Geolocation-Aufrufe, um Permissions Policy Verletzungen zu vermeiden
    return 'prompt' // Sicherheitshalber 'prompt' zurückgeben
  }
}


/**
 * Fordert Standortberechtigung an
 * @returns {Promise<'granted'|'denied'|'error'>}
 */
export async function requestLocationPermission() {
  if (!navigator.geolocation) {
    logError('Geolocation wird nicht unterstützt')
    return 'error'
  }
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        logInfo('Standortberechtigung erteilt')
        resolve('granted')
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          logWarn('Standortberechtigung verweigert')
          resolve('denied')
        } else {
          logError('Fehler beim Anfordern der Standortberechtigung', { error: error.message })
          resolve('error')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  })
}

/**
 * Prüft den Status der Benachrichtigungsberechtigung
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function checkNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  
  // Notification.permission ist synchron verfügbar
  const permission = Notification.permission
  
  if (permission === 'granted') {
    return 'granted'
  } else if (permission === 'denied') {
    return 'denied'
  } else {
    return 'default' // 'default' bedeutet 'prompt' - noch nicht angefragt
  }
}

/**
 * Fordert Benachrichtigungsberechtigung an
 * @returns {Promise<'granted'|'denied'|'error'>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    logError('Benachrichtigungen werden nicht unterstützt')
    return 'error'
  }
  
  try {
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      logInfo('Benachrichtigungsberechtigung erteilt')
      return 'granted'
    } else {
      logWarn('Benachrichtigungsberechtigung verweigert')
      return 'denied'
    }
  } catch (error) {
    logError('Fehler beim Anfordern der Benachrichtigungsberechtigung', { error: error.message })
    return 'error'
  }
}

/**
 * Öffnet die Systemeinstellungen für Berechtigungen (falls möglich)
 * @param {string} permissionType - 'location' oder 'notification'
 */
export function openSystemSettings(permissionType = 'location') {
  const platform = detectPlatform()
  
  if (platform.isIOS) {
    // iOS: Kann nicht direkt zu Einstellungen navigieren, aber Hinweis anzeigen
    alert(
      'Bitte öffnen Sie die Einstellungen-App und erlauben Sie den Zugriff auf Standortdaten für TankCopilot.\n\n' +
      'Einstellungen > TankCopilot > Standort'
    )
  } else if (platform.isAndroid) {
    // Android: Versuche Intent zu öffnen (funktioniert nur in WebView/App-Kontext)
    try {
      // Für Android WebView/Chrome Custom Tabs
      if (window.Android && typeof window.Android.openSettings === 'function') {
        window.Android.openSettings(permissionType)
      } else {
        // Fallback: Hinweis anzeigen
        alert(
          'Bitte öffnen Sie die Einstellungen und erlauben Sie den Zugriff auf Standortdaten für TankCopilot.\n\n' +
          'Einstellungen > Apps > TankCopilot > Berechtigungen > Standort'
        )
      }
    } catch (error) {
      logWarn('Konnte Systemeinstellungen nicht öffnen', { error: error.message })
      alert(
        'Bitte öffnen Sie die Einstellungen und erlauben Sie den Zugriff auf Standortdaten für TankCopilot.\n\n' +
        'Einstellungen > Apps > TankCopilot > Berechtigungen > Standort'
      )
    }
  } else {
    // Desktop: Browser-Einstellungen
    alert(
      'Bitte erlauben Sie den Zugriff auf Standortdaten in Ihren Browser-Einstellungen.\n\n' +
      'Klicken Sie auf das Schloss-Symbol in der Adressleiste und erlauben Sie Standortdaten.'
    )
  }
}

/**
 * Prüft alle Berechtigungen beim App-Start
 * @returns {Promise<{location: string, notification: string}>}
 */
export async function checkAllPermissions() {
  const [location, notification] = await Promise.all([
    checkLocationPermission(),
    checkNotificationPermission()
  ])
  
  return {
    location,
    notification
  }
}

