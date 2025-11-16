<template>
  <div class="plan-refuel-view">
    <h2>Tankstellen finden</h2>

    <div v-if="vehicles.length === 0" class="empty-state">
      <Car :size="64" weight="duotone" class="empty-state-icon" />
      <p>Bitte fügen Sie zuerst ein Fahrzeug hinzu</p>
      <router-link to="/vehicles" class="btn btn-primary">
        Fahrzeug hinzufügen
      </router-link>
    </div>

    <div v-else class="search-form card">
      <div class="form-group">
        <label class="form-label">Fahrzeug</label>
        <select v-model="selectedVehicleId" class="form-select" required>
          <option value="">Bitte wählen</option>
          <option
            v-for="vehicle in vehicles"
            :key="vehicle.id"
            :value="vehicle.id"
          >
            {{ vehicle.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Aktueller Tankfüllstand (%)</label>
        <input
          v-model.number="fuelLevelPercent"
          type="number"
          class="form-input"
          min="0"
          max="100"
          step="1"
          placeholder="z.B. 50"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Suchradius (km)</label>
        <input
          v-model.number="radiusKm"
          type="number"
          class="form-input"
          min="1"
          max="50"
          step="1"
          placeholder="10"
        />
      </div>

      <button
        class="btn btn-primary"
        :disabled="!selectedVehicleId || searching"
        @click="searchStations"
        aria-label="Tankstellen in der Nähe suchen"
      >
        <MapPin :size="20" weight="bold" v-if="!searching" aria-hidden="true" />
        <span v-if="searching">Suche...</span>
        <span v-else>Tankstellen suchen</span>
      </button>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div v-if="!isOnline" class="warning-message">
        <strong>Offline-Modus:</strong> Sie sind nicht mit dem Internet verbunden. Bitte stellen Sie eine Verbindung her, um echte Tankstellendaten zu erhalten.
      </div>
      
      <div v-if="showMockWarning" class="info-message">
        <strong>Hinweis:</strong> Mock-Daten werden verwendet. Für optimale Ergebnisse konfigurieren Sie bitte einen Tankerkönig API-Key in der Backend-Konfiguration.
      </div>
      
      <!-- Status-Meldungen während der Suche -->
      <div v-if="searching && statusMessage" class="status-message">
        <div class="status-spinner"></div>
        <span>{{ statusMessage }}</span>
      </div>
      
      <!-- Aktueller Standort anzeigen -->
      <div v-if="currentLocation" class="location-info">
        <div v-if="currentLocation.address" class="location-address-primary">
          <strong>Ihr Standort:</strong> {{ currentLocation.address }}
        </div>
        <div v-else class="location-coordinates">
          <strong>Koordinaten:</strong> {{ currentLocation.lat.toFixed(6) }}, {{ currentLocation.lng.toFixed(6) }}
        </div>
      </div>
    </div>

    <div v-if="stations.length > 0" class="stations-section">
      <h3>Gefundene Tankstellen</h3>
      <StationList :stations="stations" />
    </div>
    
    <div v-if="showLocationInput" class="location-input-overlay" @click.self="showLocationInput = false">
      <div class="location-input-modal">
        <LocationInput 
          @confirm="handleLocationConfirm"
          @cancel="showLocationInput = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PhCar as Car, PhMapPin as MapPin } from '@phosphor-icons/vue'
import StationList from '../components/StationList.vue'
import { loadVehicles, loadSettings } from '../services/storageService'
import { getCurrentLocationWithFallbacks } from '../services/geoService'
import LocationInput from '../components/LocationInput.vue'
import { searchStations as searchStationsAPI, enrichStationsWithRoutes, calculateStationSavings, reverseGeocode } from '../services/fuelStationService'

const vehicles = ref([])
const selectedVehicleId = ref('')
const fuelLevelPercent = ref(50)
const radiusKm = ref(10)
const searching = ref(false)
const stations = ref([])
const error = ref('')
const showLocationInput = ref(false)
const isOnline = ref(true) // Standardmäßig online annehmen
const showMockWarning = ref(false)
const statusMessage = ref('')
const currentLocation = ref(null)

const selectedVehicle = computed(() => {
  return vehicles.value.find(v => v.id === selectedVehicleId.value)
})

async function searchStations() {
  if (!selectedVehicle.value) {
    error.value = 'Bitte wählen Sie ein Fahrzeug aus'
    return
  }

  if (fuelLevelPercent.value < 0 || fuelLevelPercent.value > 100) {
    error.value = 'Tankfüllstand muss zwischen 0 und 100% liegen'
    return
  }

  searching.value = true
  error.value = ''
  statusMessage.value = 'Ermittle Standort...'
  currentLocation.value = null

  try {
    const settings = await loadSettings()
    
    if (!settings.allowGeolocation) {
      error.value = 'Geolocation ist in den Einstellungen deaktiviert. Bitte aktivieren Sie die Standortfreigabe.'
      searching.value = false
      statusMessage.value = ''
      return
    }

    let location
    
    try {
      statusMessage.value = 'Ermittle Standort...'
      location = await getCurrentLocationWithFallbacks()
      
      // Speichere aktuellen Standort für Anzeige
      currentLocation.value = {
        lat: location.lat,
        lng: location.lng,
        address: null
      }
      
      // Versuche Adresse zu ermitteln (im Hintergrund, blockiert nicht)
      // Mache Reverse Geocoding parallel zur Tankstellensuche, damit es nicht blockiert
      reverseGeocode(location.lat, location.lng).then(address => {
        if (address && currentLocation.value) {
          currentLocation.value.address = address
        }
      }).catch(err => {
        // Ignoriere Fehler bei Reverse Geocoding - nicht kritisch
        console.warn('Reverse Geocoding fehlgeschlagen:', err)
      })
      
      statusMessage.value = 'Suche Tankstellen in der Nähe...'
    } catch (err) {
      // Wenn GPS fehlschlägt, zeige manuelle Eingabe
      if (err.message === 'PERMISSION_DENIED' || err.message === 'POSITION_UNAVAILABLE' || err.message === 'TIMEOUT' || err.message === 'GEOLOCATION_NOT_SUPPORTED') {
        // Zeige benutzerfreundliche Fehlermeldung
        if (err.userMessage) {
          error.value = err.userMessage
        } else {
          error.value = 'Standort konnte nicht ermittelt werden. Bitte geben Sie Ihren Standort manuell ein.'
        }
        showLocationInput.value = true
        searching.value = false
        statusMessage.value = ''
        return
      }
      throw err
    }
    
    statusMessage.value = 'Lade Tankstellendaten von API...'
    const result = await searchStationsAPI(
      location.lat,
      location.lng,
      radiusKm.value,
      selectedVehicle.value.fuelType
    )
    
    statusMessage.value = 'Berechne Routen und Ersparnisse...'

    const foundStations = result.stations || []
    const meta = result.meta || {}

    // Zeige Warnung nur wenn wirklich Mock-Daten verwendet werden
    if (meta.isMock && !meta.isOffline) {
      console.warn('Mock-Daten werden verwendet. Bitte konfigurieren Sie einen Tankerkönig API-Key für echte Spritpreise.')
      showMockWarning.value = true
    } else if (meta.isCached) {
      showMockWarning.value = false
      // Optional: Zeige Info dass Daten aus Cache kommen
      console.info('Tankstellendaten aus Cache geladen')
    } else {
      showMockWarning.value = false
    }

    if (foundStations.length === 0) {
      error.value = 'Keine Tankstellen in der Nähe gefunden'
      if (meta.apiError) {
        error.value += ` (${meta.apiError})`
      }
      searching.value = false
      return
    }

    const enrichedStations = await enrichStationsWithRoutes(
      foundStations,
      location.lat,
      location.lng
    )

    const stationsWithSavings = calculateStationSavings(
      enrichedStations,
      selectedVehicle.value,
      fuelLevelPercent.value
    )

    stations.value = stationsWithSavings
    statusMessage.value = ''
  } catch (err) {
    console.error('Fehler bei der Tankstellensuche:', err)
    error.value = err.message || 'Fehler bei der Tankstellensuche'
    statusMessage.value = ''
  } finally {
    searching.value = false
  }
}

async function handleLocationConfirm(locationData) {
  showLocationInput.value = false
  searching.value = true
  statusMessage.value = 'Lade Tankstellendaten von API...'
  currentLocation.value = {
    lat: locationData.lat,
    lng: locationData.lng,
    address: locationData.address || null
  }
  
  try {
    const result = await searchStationsAPI(
      locationData.lat,
      locationData.lng,
      radiusKm.value,
      selectedVehicle.value.fuelType
    )
    
    statusMessage.value = 'Berechne Routen und Ersparnisse...'

    const foundStations = result.stations || []
    const meta = result.meta || {}

    // Zeige Warnung wenn Mock-Daten verwendet werden
    if (meta.isMock && !meta.isOffline) {
      console.warn('Mock-Daten werden verwendet. Bitte konfigurieren Sie einen Tankerkönig API-Key.')
      showMockWarning.value = true
    } else if (meta.isCached) {
      showMockWarning.value = false
      console.info('Tankstellendaten aus Cache geladen')
    } else {
      showMockWarning.value = false
    }

    if (foundStations.length === 0) {
      error.value = 'Keine Tankstellen in der Nähe gefunden'
      if (meta.apiError) {
        error.value += ` (${meta.apiError})`
      }
      return
    }

    const enrichedStations = await enrichStationsWithRoutes(
      foundStations,
      locationData.lat,
      locationData.lng
    )

    const stationsWithSavings = calculateStationSavings(
      enrichedStations,
      selectedVehicle.value,
      fuelLevelPercent.value
    )

    stations.value = stationsWithSavings
    statusMessage.value = ''
    searching.value = false
  } catch (err) {
    console.error('Fehler bei der Tankstellensuche:', err)
    error.value = err.message || 'Fehler bei der Tankstellensuche'
    statusMessage.value = ''
    searching.value = false
  }
}

// Network-Status-Tracking mit zuverlässigerer Erkennung
async function updateOnlineStatus() {
  // Prüfe zuerst navigator.onLine
  const browserOnline = navigator.onLine
  
  // Wenn Browser sagt offline, teste tatsächlich die Verbindung
  if (!browserOnline) {
    // Versuche einen kleinen Request, um echten Offline-Status zu prüfen
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 Sekunden Timeout
      
      const response = await fetch(window.location.origin + '/TankCopilot/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      isOnline.value = response.ok
    } catch (err) {
      // Request fehlgeschlagen = wirklich offline
      isOnline.value = false
    }
  } else {
    // Browser sagt online, vertraue darauf (aber setze nicht automatisch Fehler)
    isOnline.value = true
  }
  
  // Entferne automatische Fehlermeldung - wird nur bei tatsächlichen API-Fehlern gesetzt
}

onMounted(async () => {
  vehicles.value = await loadVehicles()
  if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }
  
  // Network-Status-Listener
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  updateOnlineStatus()
})

  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })
</script>

<style scoped>
.plan-refuel-view {
  width: 100%;
}

.search-form {
  margin-bottom: var(--spacing);
}

.error-message {
  margin-top: var(--spacing);
  padding: 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.warning-message {
  margin-top: var(--spacing);
  padding: 12px;
  background: #fff3cd;
  color: #856404;
  border-radius: var(--radius);
  font-size: 0.9rem;
  border: 1px solid #ffc107;
}

.info-message {
  margin-top: var(--spacing);
  padding: 12px;
  background: rgba(0, 168, 168, 0.1);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-size: 0.9rem;
  border: 1px solid rgba(0, 168, 168, 0.3);
}

.status-message {
  margin-top: var(--spacing);
  padding: 12px;
  background: rgba(0, 168, 168, 0.1);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 168, 168, 0.3);
  border-top-color: var(--primary-color, #00A8A8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.location-info {
  margin-top: var(--spacing);
  padding: 8px 12px;
  background: rgba(0, 168, 168, 0.05);
  color: var(--text-secondary, #666);
  border-radius: var(--radius);
  font-size: 0.85rem;
  border: 1px solid rgba(0, 168, 168, 0.2);
}

.location-address-primary {
  color: var(--text-primary, #1a3a3a);
  font-weight: 500;
}

.location-coordinates {
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
}

.location-address {
  display: block;
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary, #888);
}

.stations-section {
  margin-top: calc(var(--spacing) * 2);
}

.stations-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.location-input-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: var(--spacing);
}

.location-input-modal {
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius);
  box-shadow: var(--shadow-elevated);
  border: 1px solid var(--glass-border);
  width: 100%;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  padding: var(--spacing);
}
</style>

