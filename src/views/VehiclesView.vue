<template>
  <div class="vehicles-view">
    <div class="view-header">
      <h2>Fahrzeuge</h2>
      <button 
        class="btn btn-primary" 
        @click="showForm = true"
        aria-label="Neues Fahrzeug hinzufügen"
      >
        <Plus :size="20" weight="bold" aria-hidden="true" />
        Fahrzeug hinzufügen
      </button>
    </div>

    <div v-if="vehicles.length === 0" class="empty-state">
      <Car :size="64" weight="duotone" class="empty-state-icon" />
      <p>Noch keine Fahrzeuge vorhanden</p>
      <p class="empty-state-hint">Fügen Sie Ihr erstes Fahrzeug hinzu</p>
    </div>

    <div v-else class="vehicles-grid">
      <div
        v-for="vehicle in vehicles"
        :key="vehicle.id"
        class="vehicle-card"
      >
        <div class="vehicle-card-header">
          <div>
            <h3 class="vehicle-card-name">{{ vehicle.name }}</h3>
            <div class="vehicle-card-fuel">{{ vehicle.fuelType }}</div>
          </div>
          <Car :size="32" weight="duotone" class="vehicle-card-icon" />
        </div>

        <div class="vehicle-card-content">
          <!-- Verbrauchs-Chart -->
          <div v-if="getVehicleRefuels(vehicle.id).length >= 2" class="chart-section">
            <h4 class="section-title">Verbrauch</h4>
            <div class="chart-container">
              <div class="chart-bars">
                <div
                  v-for="(segment, index) in getConsumptionSegments(vehicle.id)"
                  :key="index"
                  class="chart-bar"
                  :style="{ height: `${Math.min((segment.consumption / maxConsumption) * 100, 100)}%` }"
                  :title="`${segment.consumption.toFixed(2)} L/100km`"
                >
                  <div class="chart-bar-value">{{ segment.consumption.toFixed(1) }}</div>
                </div>
              </div>
            </div>
            <div class="chart-legend">
              <span>Ø {{ getAverageConsumption(vehicle.id).toFixed(2) }} L/100km</span>
            </div>
          </div>
          <div v-else class="chart-section">
            <h4 class="section-title">Verbrauch</h4>
            <div class="chart-empty">
              <p>Noch nicht genug Daten für Chart</p>
            </div>
          </div>

          <!-- Kilometerstand -->
          <div class="info-section">
            <h4 class="section-title">Kilometerstand</h4>
            <div class="info-value">
              {{ getLastOdometer(vehicle.id) || '—' }} km
            </div>
            <div v-if="getLastRefuel(vehicle.id)" class="info-hint">
              Stand: {{ formatDate(getLastRefuel(vehicle.id).date) }}
            </div>
          </div>

          <!-- Letzte Tankung -->
          <div class="info-section">
            <h4 class="section-title">Letzte Tankung</h4>
            <div v-if="getLastRefuel(vehicle.id)" class="refuel-info">
              <div class="refuel-info-row">
                <span class="refuel-info-label">Datum:</span>
                <span class="refuel-info-value">{{ formatDate(getLastRefuel(vehicle.id).date) }}</span>
              </div>
              <div class="refuel-info-row">
                <span class="refuel-info-label">Liter:</span>
                <span class="refuel-info-value">{{ getLastRefuel(vehicle.id).liters }} L</span>
              </div>
              <div class="refuel-info-row">
                <span class="refuel-info-label">Preis:</span>
                <span class="refuel-info-value">{{ formatPrice(getLastRefuel(vehicle.id).totalPrice) }} {{ currency }}</span>
              </div>
            </div>
            <div v-else class="info-empty">
              Noch keine Tankung erfasst
            </div>
          </div>

          <!-- Fahrzeugdetails -->
          <div class="info-section">
            <h4 class="section-title">Details</h4>
            <div class="vehicle-details-info">
              <div class="detail-row">
                <span class="detail-label">Tankgröße:</span>
                <span class="detail-value">{{ vehicle.tankCapacityLiters }} L</span>
              </div>
              <div v-if="vehicle.avgConsumptionLPer100km" class="detail-row">
                <span class="detail-label">Ø Verbrauch:</span>
                <span class="detail-value consumption">{{ vehicle.avgConsumptionLPer100km }} L/100km</span>
              </div>
            </div>
          </div>

          <!-- Aktionen -->
          <div class="vehicle-actions">
            <button
              class="btn btn-secondary"
              @click="handleEdit(vehicle)"
              :aria-label="`Fahrzeug ${vehicle.name} bearbeiten`"
            >
              <Pencil :size="18" weight="regular" aria-hidden="true" />
              Bearbeiten
            </button>
            <button
              class="btn btn-danger"
              @click="handleDelete(vehicle.id)"
              :aria-label="`Fahrzeug ${vehicle.name} löschen`"
            >
              <Trash :size="18" weight="regular" aria-hidden="true" />
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click="closeForm">
      <div class="modal-content" @click.stop>
        <VehicleForm
          :vehicle="editingVehicle"
          @saved="handleSaved"
          @cancel="closeForm"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { PhPlus as Plus, PhCar as Car, PhPencil as Pencil, PhTrash as Trash } from '@phosphor-icons/vue'
import VehicleForm from '../components/VehicleForm.vue'
import { loadVehicles, loadRefuels, deleteVehicle } from '../services/storageService'
import { loadSettings } from '../services/storageService'
import { calculateConsumption } from '../services/consumptionService'

const vehicles = ref([])
const refuels = ref([])
const currency = ref('EUR')
const showForm = ref(false)
const editingVehicle = ref(null)

function getVehicleRefuels(vehicleId) {
  return refuels.value
    .filter(r => r.vehicleId === vehicleId)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

function getLastRefuel(vehicleId) {
  const vehicleRefuels = getVehicleRefuels(vehicleId)
  if (vehicleRefuels.length === 0) return null
  return vehicleRefuels[vehicleRefuels.length - 1]
}

function getLastOdometer(vehicleId) {
  const lastRefuel = getLastRefuel(vehicleId)
  return lastRefuel ? lastRefuel.odometerKm : null
}

function getConsumptionSegments(vehicleId) {
  const vehicleRefuels = getVehicleRefuels(vehicleId)
  if (vehicleRefuels.length < 2) return []

  const segments = []
  for (let i = 1; i < vehicleRefuels.length; i++) {
    const current = vehicleRefuels[i]
    const previous = vehicleRefuels[i - 1]
    const kmDelta = current.odometerKm - previous.odometerKm

    if (kmDelta > 0 && current.liters > 0) {
      const consumption = (current.liters / kmDelta) * 100
      segments.push({
        consumption,
        date: current.date,
        kmDelta
      })
    }
  }

  // Nimm die letzten 10 Segmente für den Chart
  return segments.slice(-10)
}

const maxConsumption = computed(() => {
  let max = 0
  vehicles.value.forEach(vehicle => {
    const segments = getConsumptionSegments(vehicle.id)
    segments.forEach(seg => {
      if (seg.consumption > max) max = seg.consumption
    })
  })
  return max || 20 // Fallback auf 20 L/100km
})

function getAverageConsumption(vehicleId) {
  const vehicleRefuels = getVehicleRefuels(vehicleId)
  const avg = calculateConsumption(vehicleId, vehicleRefuels)
  return avg || 0
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatPrice(price) {
  return price.toFixed(2)
}

async function loadData() {
  vehicles.value = await loadVehicles()
  refuels.value = await loadRefuels()
  
  const settings = await loadSettings()
  currency.value = settings.currency || 'EUR'
}

function handleEdit(vehicle) {
  editingVehicle.value = vehicle
  showForm.value = true
}

async function handleDelete(vehicleId) {
  if (!confirm('Möchten Sie dieses Fahrzeug wirklich löschen? Alle zugehörigen Tankvorgänge werden ebenfalls gelöscht.')) {
    return
  }
  
  try {
    await deleteVehicle(vehicleId)
    // Lösche auch alle zugehörigen Tankvorgänge
    const vehicleRefuels = refuels.value.filter(r => r.vehicleId === vehicleId)
    for (const refuel of vehicleRefuels) {
      await import('../services/storageService').then(m => m.deleteRefuel(refuel.id))
    }
    await loadData()
  } catch (error) {
    console.error('Fehler beim Löschen des Fahrzeugs:', error)
    alert('Fehler beim Löschen des Fahrzeugs')
  }
}

function handleSaved() {
  loadData()
  closeForm()
}

function closeForm() {
  showForm.value = false
  editingVehicle.value = null
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.vehicles-view {
  width: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.view-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.vehicles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing);
}

.vehicle-card {
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius);
  padding: var(--spacing);
  box-shadow: var(--shadow);
  border: 1px solid var(--glass-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.vehicle-card:hover {
  background: var(--surface-hover);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.vehicle-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing);
  padding-bottom: var(--spacing);
  border-bottom: 1px solid var(--glass-border);
}

.vehicle-card-name {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.vehicle-card-fuel {
  font-size: 0.9rem;
  color: var(--text-secondary);
  padding: 4px 8px;
  background: var(--primary-light);
  border-radius: 6px;
  display: inline-block;
  border: 1px solid rgba(0, 168, 168, 0.2);
}

.vehicle-card-icon {
  color: var(--primary-color);
  opacity: 0.3;
}

.vehicle-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chart-section {
  padding: var(--spacing-small);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
}

.chart-container {
  height: 120px;
  margin-bottom: 8px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100%;
  gap: 4px;
}

.chart-bar {
  flex: 1;
  background: linear-gradient(to top, var(--primary-color), var(--accent-color));
  border-radius: 4px 4px 0 0;
  min-height: 20px;
  position: relative;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 168, 168, 0.2);
}

.chart-bar:hover {
  opacity: 0.8;
  transform: scaleY(1.05);
}

.chart-bar-value {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-color);
  white-space: nowrap;
}

.chart-legend {
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.chart-empty {
  text-align: center;
  padding: var(--spacing);
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.info-section {
  padding: var(--spacing-small);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
}

.info-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 4px;
}

.info-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.info-empty {
  color: var(--text-tertiary);
  font-size: 0.9rem;
  font-style: italic;
}

.refuel-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.refuel-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refuel-info-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.refuel-info-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.vehicle-details-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-value.consumption {
  color: var(--primary-color);
}

.vehicle-actions {
  display: flex;
  gap: 8px;
  margin-top: var(--spacing-small);
}

.vehicle-actions .btn {
  flex: 1;
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
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius);
  padding: var(--spacing);
  max-width: 90vw;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-elevated);
}

@media (max-width: 600px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing);
  }

  .view-header .btn {
    width: 100%;
  }

  .vehicles-grid {
    grid-template-columns: 1fr;
  }
}
</style>
