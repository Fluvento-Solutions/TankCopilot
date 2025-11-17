/**
 * Storage Service - IndexedDB Wrapper
 * 
 * Datenbank-Struktur:
 * - Store: 'vehicles' - Fahrzeuge
 * - Store: 'refuels' - Tankvorgänge
 * - Store: 'settings' - Einstellungen
 * - Store: 'logs' - Protokolle
 * - Store: 'trips' - Fahrten
 */

import { logInfo, logWarn, logError } from './logService'

const DB_NAME = 'TankCopilotDB'
const DB_VERSION = 4 // Erhöht um trips Store zu erstellen

let db = null

/**
 * Öffnet die IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result
      const transaction = event.target.transaction

      // Vehicles Store
      if (!database.objectStoreNames.contains('vehicles')) {
        const vehicleStore = database.createObjectStore('vehicles', { keyPath: 'id' })
        vehicleStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Refuels Store
      if (!database.objectStoreNames.contains('refuels')) {
        const refuelStore = database.createObjectStore('refuels', { keyPath: 'id' })
        refuelStore.createIndex('vehicleId', 'vehicleId', { unique: false })
        refuelStore.createIndex('date', 'date', { unique: false })
        refuelStore.createIndex('odometerKm', 'odometerKm', { unique: false })
      }

      // Settings Store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }

      // Logs Store (für logService.js)
      if (!database.objectStoreNames.contains('logs')) {
        const logStore = database.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
        logStore.createIndex('timestamp', 'timestamp', { unique: false })
        logStore.createIndex('level', 'level', { unique: false })
      }

      // Trips Store (für Fahrten-Tracking)
      if (!database.objectStoreNames.contains('trips')) {
        const tripStore = database.createObjectStore('trips', { keyPath: 'id' })
        tripStore.createIndex('vehicleId', 'vehicleId', { unique: false })
        tripStore.createIndex('startDate', 'startDate', { unique: false })
        tripStore.createIndex('endDate', 'endDate', { unique: false })
        tripStore.createIndex('status', 'status', { unique: false })
      }
    }
  })
}

// ==================== VEHICLES ====================

/**
 * Lädt alle Fahrzeuge
 */
export async function loadVehicles() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readonly')
      const store = transaction.objectStore('vehicles')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Fahrzeuge:', error)
    return []
  }
}

/**
 * Speichert alle Fahrzeuge (überschreibt vorhandene)
 */
export async function saveVehicles(vehiclesArray) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readwrite')
      const store = transaction.objectStore('vehicles')
      
      // Alle löschen
      store.clear()
      
      // Neue hinzufügen
      vehiclesArray.forEach(vehicle => {
        store.put(vehicle)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern der Fahrzeuge:', error)
    throw error
  }
}

/**
 * Holt ein Fahrzeug nach ID
 */
export async function getVehicleById(id) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readonly')
      const store = transaction.objectStore('vehicles')
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden des Fahrzeugs:', error)
    return null
  }
}

/**
 * Fügt ein Fahrzeug hinzu oder aktualisiert es
 */
export async function upsertVehicle(vehicle) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readwrite')
      const store = transaction.objectStore('vehicles')
      
      const now = new Date().toISOString()
      if (!vehicle.id) {
        vehicle.id = generateId()
        vehicle.createdAt = now
      }
      vehicle.updatedAt = now

      const request = store.put(vehicle)

      request.onsuccess = () => {
        // Event für Sync-Service auslösen
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'vehicle', action: vehicle.id ? 'update' : 'create', data: vehicle }
        }))
        resolve(vehicle)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern des Fahrzeugs:', error)
    throw error
  }
}

/**
 * Löscht ein Fahrzeug
 */
export async function deleteVehicle(id) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readwrite')
      const store = transaction.objectStore('vehicles')
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Löschen des Fahrzeugs:', error)
    throw error
  }
}

// ==================== REFUELS ====================

/**
 * Lädt alle Tankvorgänge
 */
export async function loadRefuels() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readonly')
      const store = transaction.objectStore('refuels')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Tankvorgänge:', error)
    return []
  }
}

/**
 * Speichert alle Tankvorgänge (überschreibt vorhandene)
 */
export async function saveRefuels(refuelsArray) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readwrite')
      const store = transaction.objectStore('refuels')
      
      store.clear()
      refuelsArray.forEach(refuel => {
        store.put(refuel)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern der Tankvorgänge:', error)
    throw error
  }
}

/**
 * Holt alle Tankvorgänge für ein Fahrzeug
 */
export async function getRefuelsByVehicleId(vehicleId) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readonly')
      const store = transaction.objectStore('refuels')
      const index = store.index('vehicleId')
      const request = index.getAll(vehicleId)

      request.onsuccess = () => {
        const refuels = request.result || []
        // Sortiere nach Datum absteigend
        refuels.sort((a, b) => new Date(b.date) - new Date(a.date))
        resolve(refuels)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Tankvorgänge:', error)
    return []
  }
}

/**
 * Fügt einen Tankvorgang hinzu oder aktualisiert ihn
 */
export async function upsertRefuel(refuelEntry) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readwrite')
      const store = transaction.objectStore('refuels')
      
      if (!refuelEntry.id) {
        refuelEntry.id = generateId()
      }
      
      // Berechne totalPrice falls nicht gesetzt
      if (!refuelEntry.totalPrice && refuelEntry.liters && refuelEntry.pricePerLiter) {
        refuelEntry.totalPrice = refuelEntry.liters * refuelEntry.pricePerLiter
      }
      
      const now = new Date().toISOString()
      if (!refuelEntry.createdAt) {
        refuelEntry.createdAt = now
      }
      refuelEntry.updatedAt = now

      const request = store.put(refuelEntry)

      request.onsuccess = () => {
        // Event für Sync-Service auslösen
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'refuel', action: refuelEntry.id ? 'update' : 'create', data: refuelEntry }
        }))
        resolve(refuelEntry)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern des Tankvorgangs:', error)
    throw error
  }
}

/**
 * Löscht einen Tankvorgang
 */
export async function deleteRefuel(id) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readwrite')
      const store = transaction.objectStore('refuels')
      const request = store.delete(id)

      request.onsuccess = () => {
        // Event für Sync-Service auslösen
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'refuel', action: 'delete', id }
        }))
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Löschen des Tankvorgangs:', error)
    throw error
  }
}

// ==================== SETTINGS ====================

/**
 * Löscht alle lokalen Daten (IndexedDB)
 */
/**
 * Exportiert alle Daten im JSON-Format (DSGVO Art. 20 - Datenübertragbarkeit)
 */
export async function exportAllData() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles', 'refuels', 'settings'], 'readonly')
      
      const vehiclesRequest = transaction.objectStore('vehicles').getAll()
      const refuelsRequest = transaction.objectStore('refuels').getAll()
      const settingsRequest = transaction.objectStore('settings').getAll()
      
      let vehicles = []
      let refuels = []
      let settingsArray = []
      let completed = 0
      
      vehiclesRequest.onsuccess = () => {
        vehicles = vehiclesRequest.result
        completed++
        if (completed === 3) {
          const settingsObj = {}
          settingsArray.forEach(item => {
            settingsObj[item.key] = item.value
          })
          resolve({
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            vehicles,
            refuels,
            settings: settingsObj
          })
        }
      }
      
      refuelsRequest.onsuccess = () => {
        refuels = refuelsRequest.result
        completed++
        if (completed === 3) {
          const settingsObj = {}
          settingsArray.forEach(item => {
            settingsObj[item.key] = item.value
          })
          resolve({
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            vehicles,
            refuels,
            settings: settingsObj
          })
        }
      }
      
      settingsRequest.onsuccess = () => {
        settingsArray = settingsRequest.result
        completed++
        if (completed === 3) {
          const settingsObj = {}
          settingsArray.forEach(item => {
            settingsObj[item.key] = item.value
          })
          resolve({
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            vehicles,
            refuels,
            settings: settingsObj
          })
        }
      }
      
      vehiclesRequest.onerror = () => reject(vehiclesRequest.error)
      refuelsRequest.onerror = () => reject(refuelsRequest.error)
      settingsRequest.onerror = () => reject(settingsRequest.error)
    })
  } catch (error) {
    console.error('Fehler beim Exportieren der Daten:', error)
    throw error
  }
}

export async function deleteAllData() {
  try {
    const database = await openDB()
    
    // Lösche alle Stores
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles', 'refuels', 'settings'], 'readwrite')
      
      let completed = 0
      const total = 3
      
      const checkComplete = () => {
        completed++
        if (completed === total) {
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
        }
      }
      
      const vehicleStore = transaction.objectStore('vehicles')
      const vehicleRequest = vehicleStore.clear()
      vehicleRequest.onsuccess = checkComplete
      vehicleRequest.onerror = () => reject(vehicleRequest.error)
      
      const refuelStore = transaction.objectStore('refuels')
      const refuelRequest = refuelStore.clear()
      refuelRequest.onsuccess = checkComplete
      refuelRequest.onerror = () => reject(refuelRequest.error)
      
      const settingsStore = transaction.objectStore('settings')
      const settingsRequest = settingsStore.clear()
      settingsRequest.onsuccess = checkComplete
      settingsRequest.onerror = () => reject(settingsRequest.error)
    })
  } catch (error) {
    console.error('Fehler beim Löschen aller Daten:', error)
    throw error
  }
}

/**
 * Lädt alle Einstellungen
 */
export async function loadSettings() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['settings'], 'readonly')
      const store = transaction.objectStore('settings')
      const request = store.getAll()

      request.onsuccess = () => {
        const settingsArray = request.result || []
        const settings = {}
        settingsArray.forEach(item => {
          settings[item.key] = item.value
        })
        
        // Defaults setzen falls nicht vorhanden
        const defaults = {
          allowGeolocation: true,
          currency: 'EUR',
          language: 'de',
          distanceUnit: 'km',
          preferredNavigationApp: 'auto'
        }
        
        resolve({ ...defaults, ...settings })
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Einstellungen:', error)
    // Fallback zu Defaults
    return {
      allowGeolocation: true,
      currency: 'EUR',
      language: 'de',
      distanceUnit: 'km',
      preferredNavigationApp: 'auto'
    }
  }
}

/**
 * Speichert Einstellungen
 */
export async function saveSettings(settings) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')
      
      // Alle vorhandenen Settings löschen
      store.clear()
      
      // Neue Settings speichern
      Object.keys(settings).forEach(key => {
        store.put({ key, value: settings[key] })
      })

      transaction.oncomplete = () => {
        // Event für Sync-Service auslösen (nur für nicht-sensible Settings)
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'settings', action: 'update', data: settings }
        }))
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern der Einstellungen:', error)
    throw error
  }
}

// ==================== DATA STATS & SELECTIVE DELETE ====================

/**
 * Gibt Statistiken über vorhandene Daten zurück
 * @returns {Promise<{vehicles: number, refuels: number, settings: number}>}
 */
export async function getDataStats() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles', 'refuels', 'settings'], 'readonly')
      
      const vehiclesRequest = transaction.objectStore('vehicles').count()
      const refuelsRequest = transaction.objectStore('refuels').count()
      const settingsRequest = transaction.objectStore('settings').count()
      
      let vehicles = 0
      let refuels = 0
      let settings = 0
      let completed = 0
      
      vehiclesRequest.onsuccess = () => {
        vehicles = vehiclesRequest.result
        completed++
        if (completed === 3) {
          resolve({ vehicles, refuels, settings })
        }
      }
      
      refuelsRequest.onsuccess = () => {
        refuels = refuelsRequest.result
        completed++
        if (completed === 3) {
          resolve({ vehicles, refuels, settings })
        }
      }
      
      settingsRequest.onsuccess = () => {
        settings = settingsRequest.result
        completed++
        if (completed === 3) {
          resolve({ vehicles, refuels, settings })
        }
      }
      
      vehiclesRequest.onerror = () => reject(vehiclesRequest.error)
      refuelsRequest.onerror = () => reject(refuelsRequest.error)
      settingsRequest.onerror = () => reject(settingsRequest.error)
    })
  } catch (error) {
    logError('Fehler beim Laden der Daten-Statistiken', { error: error.message })
    return { vehicles: 0, refuels: 0, settings: 0 }
  }
}

/**
 * Holt alle Fahrzeuge (Alias für loadVehicles für Konsistenz)
 */
export async function getAllVehicles() {
  return await loadVehicles()
}

/**
 * Holt alle Tankvorgänge (Alias für loadRefuels für Konsistenz)
 */
export async function getAllRefuels() {
  return await loadRefuels()
}

/**
 * Löscht spezifische Fahrzeuge
 * @param {Array<string>} ids - Array von Fahrzeug-IDs
 * @returns {Promise<void>}
 */
export async function deleteVehicles(ids) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['vehicles'], 'readwrite')
      const store = transaction.objectStore('vehicles')
      
      let completed = 0
      let errors = []
      
      if (ids.length === 0) {
        resolve()
        return
      }
      
      ids.forEach(id => {
        const request = store.delete(id)
        request.onsuccess = () => {
          completed++
          if (completed === ids.length) {
            if (errors.length > 0) {
              reject(new Error(`Fehler beim Löschen: ${errors.join(', ')}`))
            } else {
              logInfo(`Fahrzeuge gelöscht`, { count: ids.length, ids })
              resolve()
            }
          }
        }
        request.onerror = () => {
          errors.push(id)
          completed++
          if (completed === ids.length) {
            if (errors.length === ids.length) {
              reject(new Error(`Fehler beim Löschen aller Fahrzeuge`))
            } else {
              logWarn(`Einige Fahrzeuge konnten nicht gelöscht werden`, { errors })
              resolve()
            }
          }
        }
      })
    })
  } catch (error) {
    logError('Fehler beim Löschen der Fahrzeuge', { error: error.message, ids })
    throw error
  }
}

/**
 * Löscht spezifische Tankvorgänge
 * @param {Array<string>} ids - Array von Tankvorgang-IDs
 * @returns {Promise<void>}
 */
export async function deleteRefuels(ids) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['refuels'], 'readwrite')
      const store = transaction.objectStore('refuels')
      
      let completed = 0
      let errors = []
      
      if (ids.length === 0) {
        resolve()
        return
      }
      
      ids.forEach(id => {
        const request = store.delete(id)
        request.onsuccess = () => {
          completed++
          if (completed === ids.length) {
            if (errors.length > 0) {
              reject(new Error(`Fehler beim Löschen: ${errors.join(', ')}`))
            } else {
              logInfo(`Tankvorgänge gelöscht`, { count: ids.length, ids })
              resolve()
            }
          }
        }
        request.onerror = () => {
          errors.push(id)
          completed++
          if (completed === ids.length) {
            if (errors.length === ids.length) {
              reject(new Error(`Fehler beim Löschen aller Tankvorgänge`))
            } else {
              logWarn(`Einige Tankvorgänge konnten nicht gelöscht werden`, { errors })
              resolve()
            }
          }
        }
      })
    })
  } catch (error) {
    logError('Fehler beim Löschen der Tankvorgänge', { error: error.message, ids })
    throw error
  }
}

/**
 * Löscht spezifische Einstellungen
 * @param {Array<string>} keys - Array von Einstellungs-Keys
 * @returns {Promise<void>}
 */
export async function deleteSettings(keys) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')
      
      let completed = 0
      let errors = []
      
      if (keys.length === 0) {
        resolve()
        return
      }
      
      keys.forEach(key => {
        const request = store.delete(key)
        request.onsuccess = () => {
          completed++
          if (completed === keys.length) {
            if (errors.length > 0) {
              reject(new Error(`Fehler beim Löschen: ${errors.join(', ')}`))
            } else {
              logInfo(`Einstellungen gelöscht`, { count: keys.length, keys })
              resolve()
            }
          }
        }
        request.onerror = () => {
          errors.push(key)
          completed++
          if (completed === keys.length) {
            if (errors.length === keys.length) {
              reject(new Error(`Fehler beim Löschen aller Einstellungen`))
            } else {
              logWarn(`Einige Einstellungen konnten nicht gelöscht werden`, { errors })
              resolve()
            }
          }
        }
      })
    })
  } catch (error) {
    logError('Fehler beim Löschen der Einstellungen', { error: error.message, keys })
    throw error
  }
}

// ==================== TRIPS ====================

/**
 * Lädt alle Fahrten
 */
export async function loadTrips() {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trips'], 'readonly')
      const store = transaction.objectStore('trips')
      const request = store.getAll()

      request.onsuccess = () => {
        const trips = request.result || []
        // Sortiere nach Startdatum absteigend
        trips.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        resolve(trips)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Fahrten:', error)
    return []
  }
}

/**
 * Holt alle Fahrten für ein Fahrzeug
 */
export async function getTripsByVehicleId(vehicleId) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trips'], 'readonly')
      const store = transaction.objectStore('trips')
      const index = store.index('vehicleId')
      const request = index.getAll(vehicleId)

      request.onsuccess = () => {
        const trips = request.result || []
        trips.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        resolve(trips)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Fahrten:', error)
    return []
  }
}

/**
 * Holt eine Fahrt nach ID
 */
export async function getTripById(id) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trips'], 'readonly')
      const store = transaction.objectStore('trips')
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Laden der Fahrt:', error)
    return null
  }
}

/**
 * Fügt eine Fahrt hinzu oder aktualisiert sie
 */
export async function upsertTrip(trip) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trips'], 'readwrite')
      const store = transaction.objectStore('trips')
      
      const now = new Date().toISOString()
      if (!trip.id) {
        trip.id = generateId()
        trip.createdAt = now
      }
      trip.updatedAt = now

      const request = store.put(trip)

      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'trip', action: trip.id ? 'update' : 'create', data: trip }
        }))
        resolve(trip)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Speichern der Fahrt:', error)
    throw error
  }
}

/**
 * Löscht eine Fahrt
 */
export async function deleteTrip(id) {
  try {
    const database = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trips'], 'readwrite')
      const store = transaction.objectStore('trips')
      const request = store.delete(id)

      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('dataChanged', {
          detail: { type: 'trip', action: 'delete', id }
        }))
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Fehler beim Löschen der Fahrt:', error)
    throw error
  }
}

// ==================== HELPER ====================

/**
 * Generiert eine eindeutige ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

