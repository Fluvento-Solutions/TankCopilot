/**
 * Log Service - Lokale Protokollierung
 * 
 * Speichert App-Protokolle in IndexedDB für Debugging und Fehleranalyse.
 */

// Verwende die gleiche DB wie storageService
const DB_NAME = 'TankCopilotDB'
const DB_VERSION = 4 // Muss mit storageService.js übereinstimmen
const LOG_STORE = 'logs'
const MAX_LOGS = 1000 // Maximale Anzahl Logs (Rotation)

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
}

/**
 * Öffnet die IndexedDB (verwendet die gleiche DB wie storageService)
 * Der Logs-Store wird in storageService.js erstellt
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Loggt eine Nachricht
 * @param {string} level - Log-Level ('debug', 'info', 'warn', 'error')
 * @param {string} message - Log-Nachricht
 * @param {Object} data - Zusätzliche Daten (optional)
 */
export async function log(level, message, data = null) {
  try {
    const db = await openDB()
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : null,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_STORE], 'readwrite')
      const store = transaction.objectStore(LOG_STORE)
      const request = store.add(logEntry)
      
      request.onsuccess = async () => {
        // Rotation: Lösche alte Logs wenn Maximum erreicht
        await rotateLogs(db)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Loggen:', error)
    // Fallback: Console-Logging
    console[level](`[${level.toUpperCase()}] ${message}`, data || '')
  }
}

/**
 * Rotiert Logs (behält nur die neuesten MAX_LOGS)
 */
async function rotateLogs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE], 'readwrite')
    const store = transaction.objectStore(LOG_STORE)
    const index = store.index('timestamp')
    const request = index.count()
    
    request.onsuccess = () => {
      const count = request.result
      
      if (count > MAX_LOGS) {
        // Lösche die ältesten Logs
        const deleteCount = count - MAX_LOGS
        const deleteRequest = index.openCursor()
        let deleted = 0
        
        deleteRequest.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor && deleted < deleteCount) {
            cursor.delete()
            deleted++
            cursor.continue()
          } else {
            resolve()
          }
        }
        deleteRequest.onerror = () => reject(deleteRequest.error)
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Holt alle Logs
 * @param {Object} options - Optionen (level, limit, since)
 * @returns {Promise<Array>}
 */
export async function getLogs(options = {}) {
  try {
    const db = await openDB()
    const { level = null, limit = 100, since = null } = options
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_STORE], 'readonly')
      const store = transaction.objectStore(LOG_STORE)
      const index = store.index('timestamp')
      const request = index.openCursor(null, 'prev') // Absteigend (neueste zuerst)
      
      const logs = []
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (!cursor) {
          resolve(logs)
          return
        }
        
        const logEntry = cursor.value
        
        // Filter nach Level
        if (level && logEntry.level !== level) {
          cursor.continue()
          return
        }
        
        // Filter nach Datum
        if (since && new Date(logEntry.timestamp) < new Date(since)) {
          resolve(logs)
          return
        }
        
        // Parse data falls vorhanden
        if (logEntry.data) {
          try {
            logEntry.data = JSON.parse(logEntry.data)
          } catch (e) {
            // Daten bleiben als String
          }
        }
        
        logs.push(logEntry)
        
        if (logs.length < limit) {
          cursor.continue()
        } else {
          resolve(logs)
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Logs:', error)
    return []
  }
}

/**
 * Löscht alle Logs
 * @returns {Promise<void>}
 */
export async function clearLogs() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_STORE], 'readwrite')
      const store = transaction.objectStore(LOG_STORE)
      const request = store.clear()
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Löschen der Logs:', error)
    throw error
  }
}

/**
 * Exportiert Logs als JSON
 * @returns {Promise<string>}
 */
export async function exportLogs() {
  try {
    const logs = await getLogs({ limit: MAX_LOGS })
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      logs
    }, null, 2)
  } catch (error) {
    console.error('Fehler beim Exportieren der Logs:', error)
    throw error
  }
}

// Convenience-Funktionen
export function logDebug(message, data) {
  return log(LOG_LEVELS.DEBUG, message, data)
}

export function logInfo(message, data) {
  return log(LOG_LEVELS.INFO, message, data)
}

export function logWarn(message, data) {
  return log(LOG_LEVELS.WARN, message, data)
}

export function logError(message, data) {
  return log(LOG_LEVELS.ERROR, message, data)
}

