<template>
  <div class="trips-view">
    <div class="view-header">
      <h2>Fahrten</h2>
      <button 
        v-if="!activeTrip"
        class="btn btn-primary" 
        @click="showForm = true"
        aria-label="Neue Fahrt hinzufügen"
      >
        <Plus :size="20" weight="bold" aria-hidden="true" />
        Neue Fahrt
      </button>
    </div>

    <!-- Aktive Fahrt Anzeige -->
    <div v-if="activeTrip" class="active-trip-card">
      <div class="trip-status">
        <div class="status-indicator" :class="activeTrip.status"></div>
        <span class="status-text">{{ activeTrip.status === 'active' ? 'Fahrt läuft' : 'Fahrt pausiert' }}</span>
      </div>
      
      <div class="trip-info">
        <div class="info-item">
          <span class="info-label">Dauer:</span>
          <span class="info-value">{{ formatDuration(liveDuration) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Strecke:</span>
          <span class="info-value">{{ formatDistance(liveDistance) }}</span>
        </div>
        <div class="info-item" v-if="activeTrip.name">
          <span class="info-label">Name:</span>
          <span class="info-value">{{ activeTrip.name }}</span>
        </div>
        <div class="info-item" v-if="activeTrip.avgSpeedKmh">
          <span class="info-label">Ø Geschwindigkeit:</span>
          <span class="info-value">{{ Math.round(activeTrip.avgSpeedKmh) }} km/h</span>
        </div>
      </div>

      <div class="trip-actions">
        <button 
          v-if="activeTrip.status === 'active'"
          class="btn btn-secondary"
          @click="handlePause"
          aria-label="Fahrt pausieren"
        >
          <Pause :size="20" weight="bold" aria-hidden="true" />
          Pausieren
        </button>
        <button 
          v-if="activeTrip.status === 'paused'"
          class="btn btn-primary"
          @click="handleResume"
          aria-label="Fahrt fortsetzen"
        >
          <Play :size="20" weight="bold" aria-hidden="true" />
          Fortsetzen
        </button>
        <button 
          class="btn btn-danger"
          @click="handleStop"
          aria-label="Fahrt beenden"
        >
          <Stop :size="20" weight="bold" aria-hidden="true" />
          Beenden
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div v-if="vehicles.length > 0" class="filters">
      <div class="form-group">
        <label class="form-label">Fahrzeug</label>
        <select v-model="selectedVehicleId" class="form-select">
          <option value="">Alle Fahrzeuge</option>
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
        <label class="form-label">Status</label>
        <select v-model="selectedStatus" class="form-select">
          <option value="">Alle</option>
          <option value="completed">Abgeschlossen</option>
          <option value="active">Aktiv</option>
          <option value="paused">Pausiert</option>
        </select>
      </div>
    </div>

    <!-- Fahrten-Liste -->
    <TripList
      :trips="filteredTrips"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <!-- Formular Modal -->
    <div v-if="showForm" class="modal-overlay" @click="closeForm">
      <div class="modal-content" @click.stop>
        <TripForm
          :vehicles="vehicles"
          :trip="editingTrip"
          @saved="handleSaved"
          @cancel="closeForm"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PhPlus as Plus, PhPause as Pause, PhPlay as Play, PhStop as Stop } from '@phosphor-icons/vue'
import TripList from '../components/TripList.vue'
import TripForm from '../components/TripForm.vue'
import { loadVehicles, loadTrips } from '../services/storageService'
import { getActiveTrip, startTrip, stopTrip, pauseTrip, resumeTrip, formatDuration, formatDistance } from '../services/tripService'
import { requestLocationPermission } from '../services/permissionService'

const vehicles = ref([])
const trips = ref([])
const activeTrip = ref(null)
const showForm = ref(false)
const editingTrip = ref(null)
const selectedVehicleId = ref('')
const selectedStatus = ref('')

let updateInterval = null
let durationUpdateInterval = null

const filteredTrips = computed(() => {
  let filtered = [...trips.value]

  // Filter nach Fahrzeug
  if (selectedVehicleId.value) {
    filtered = filtered.filter(t => t.vehicleId === selectedVehicleId.value)
  }

  // Filter nach Status
  if (selectedStatus.value) {
    filtered = filtered.filter(t => t.status === selectedStatus.value)
  }

  return filtered
})

// Live-Dauer für aktive Fahrt (wird live aktualisiert)
const liveDuration = ref(0)
const liveDistance = ref(0)

async function loadData() {
  vehicles.value = await loadVehicles()
  trips.value = await loadTrips()
  activeTrip.value = getActiveTrip()
  
  // Aktualisiere liveDuration und liveDistance wenn aktive Fahrt vorhanden
  if (activeTrip.value) {
    liveDuration.value = activeTrip.value.durationSeconds || 0
    liveDistance.value = activeTrip.value.distanceKm || 0
  }
}

function handleEdit(trip) {
  // Nur abgeschlossene Fahrten können bearbeitet werden
  if (trip.status === 'completed') {
    editingTrip.value = trip
    showForm.value = true
  }
}

async function handleDelete(tripId) {
  if (confirm('Möchten Sie diese Fahrt wirklich löschen?')) {
    const { deleteTrip } = await import('../services/storageService')
    await deleteTrip(tripId)
    await loadData()
  }
}

async function handleSaved(tripData) {
  if (tripData.status === 'active') {
    // Zeige Hinweis-Dialog vor Start
    const confirmed = await showTrackingConsentDialog()
    if (!confirmed) {
      return // User hat abgebrochen
    }

    // Fordere Geolocation-Berechtigung an
    const permission = await requestLocationPermission()
    if (permission !== 'granted') {
      alert('Standortberechtigung ist erforderlich, um eine Fahrt zu starten. Bitte erlauben Sie den Zugriff auf Standortdaten in den Einstellungen.')
      return
    }

    // Fahrt wurde gestartet
    startTrip(tripData).then(() => {
      loadData()
      showForm.value = false
      editingTrip.value = null
    }).catch(err => {
      alert('Fehler beim Starten der Fahrt: ' + err.message)
    })
  } else {
    // Fahrt wurde erstellt (ohne Start)
    loadData()
    showForm.value = false
    editingTrip.value = null
  }
}

function showTrackingConsentDialog() {
  return new Promise((resolve) => {
    const message = 
      'GPS-Tracking starten?\n\n' +
      'Die App wird Ihre Position mit einer Genauigkeit von 10 Metern alle 60 Sekunden erfassen.\n\n' +
      'Diese Daten werden nur lokal auf Ihrem Gerät gespeichert und nicht an Server übertragen.\n\n' +
      'Möchten Sie fortfahren?'
    
    const confirmed = confirm(message)
    resolve(confirmed)
  })
}

function closeForm() {
  showForm.value = false
  editingTrip.value = null
}

async function handlePause() {
  try {
    await pauseTrip()
    activeTrip.value = getActiveTrip()
  } catch (err) {
    alert('Fehler beim Pausieren: ' + err.message)
  }
}

async function handleResume() {
  try {
    await resumeTrip()
    activeTrip.value = getActiveTrip()
  } catch (err) {
    alert('Fehler beim Fortsetzen: ' + err.message)
  }
}

async function handleStop() {
  if (confirm('Möchten Sie diese Fahrt wirklich beenden?')) {
    try {
      await stopTrip()
      await loadData()
    } catch (err) {
      alert('Fehler beim Beenden: ' + err.message)
    }
  }
}

// Aktualisiere aktive Fahrt regelmäßig
function startUpdateInterval() {
  updateInterval = setInterval(() => {
    if (activeTrip.value) {
      const updatedTrip = getActiveTrip()
      if (updatedTrip) {
        activeTrip.value = updatedTrip
        // Aktualisiere liveDuration und liveDistance für Live-Anzeige
        if (updatedTrip.status === 'active' || updatedTrip.status === 'paused') {
          liveDuration.value = updatedTrip.durationSeconds || 0
          liveDistance.value = updatedTrip.distanceKm || 0
        }
      }
    }
  }, 1000) // Jede Sekunde aktualisieren
}

// Starte Live-Dauer-Update für aktive Fahrt
function startDurationUpdate() {
  if (durationUpdateInterval) {
    clearInterval(durationUpdateInterval)
  }
  
  durationUpdateInterval = setInterval(() => {
    if (activeTrip.value && (activeTrip.value.status === 'active' || activeTrip.value.status === 'paused')) {
      const updatedTrip = getActiveTrip()
      if (updatedTrip) {
        liveDuration.value = updatedTrip.durationSeconds || 0
        liveDistance.value = updatedTrip.distanceKm || 0
        // Aktualisiere auch das activeTrip-Objekt für andere Werte (Geschwindigkeit, etc.)
        activeTrip.value = updatedTrip
      }
    }
  }, 1000) // Jede Sekunde aktualisieren
}

// Stoppe Live-Dauer-Update
function stopDurationUpdate() {
  if (durationUpdateInterval) {
    clearInterval(durationUpdateInterval)
    durationUpdateInterval = null
  }
}

onMounted(async () => {
  await loadData()
  startUpdateInterval()
  // Starte Live-Dauer-Update wenn aktive Fahrt vorhanden
  if (activeTrip.value && (activeTrip.value.status === 'active' || activeTrip.value.status === 'paused')) {
    startDurationUpdate()
  }
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  stopDurationUpdate()
})

// Watch für activeTrip - starte/stoppe Duration-Update
watch(() => activeTrip.value, (newTrip) => {
  if (newTrip && (newTrip.status === 'active' || newTrip.status === 'paused')) {
    liveDuration.value = newTrip.durationSeconds || 0
    liveDistance.value = newTrip.distanceKm || 0
    startDurationUpdate()
  } else {
    stopDurationUpdate()
    if (newTrip) {
      liveDuration.value = newTrip.durationSeconds || 0
      liveDistance.value = newTrip.distanceKm || 0
    }
  }
}, { immediate: true })
</script>

<style scoped>
.trips-view {
  padding: var(--spacing);
  padding-bottom: calc(var(--spacing) + 80px); /* Platz für BottomNavBar */
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.view-header h2 {
  color: var(--text-primary);
  margin: 0;
}

.active-trip-card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: var(--spacing);
  margin-bottom: var(--spacing);
  box-shadow: var(--shadow);
  border: 2px solid var(--primary-color);
}

.trip-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-small);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary-color);
  animation: pulse 2s infinite;
}

.status-indicator.paused {
  background: var(--color-warning, #ed8936);
  animation: none;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-weight: 600;
  color: var(--text-primary);
}

.trip-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-small);
  margin-bottom: var(--spacing);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.trip-actions {
  display: flex;
  gap: var(--spacing-small);
  flex-wrap: wrap;
}

.trip-actions .btn {
  flex: 1;
  min-width: 120px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-small);
  margin-bottom: var(--spacing);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: var(--spacing);
}

.modal-content {
  background: var(--surface);
  border-radius: var(--radius);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-elevated);
}
</style>

