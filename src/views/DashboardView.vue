<template>
  <div class="dashboard">
    <div v-if="vehicles.length === 0" class="empty-state">
      <Car :size="64" weight="duotone" class="empty-state-icon" />
      <p>Willkommen bei TankCopilot!</p>
      <p class="empty-state-hint">Fügen Sie Ihr erstes Fahrzeug hinzu, um zu beginnen.</p>
      <router-link 
        to="/vehicles" 
        class="btn btn-primary"
        aria-label="Zum Fahrzeuge-Bereich navigieren, um ein Fahrzeug hinzuzufügen"
      >
        Fahrzeug hinzufügen
      </router-link>
    </div>

    <div v-else>
      <div v-if="vehicles.length > 1" class="card vehicle-selector">
        <label class="form-label">Fahrzeug auswählen</label>
        <select v-model="selectedVehicleId" class="form-select">
          <option
            v-for="vehicle in vehicles"
            :key="vehicle.id"
            :value="vehicle.id"
          >
            {{ vehicle.name }}
          </option>
        </select>
      </div>

      <div v-if="currentVehicle" class="card hero-card">
        <div class="hero-header">
          <div>
            <h2 class="hero-title">{{ currentVehicle.name }}</h2>
            <div class="hero-subtitle">{{ currentVehicle.fuelType }}</div>
          </div>
          <div class="hero-icon">
            <Car :size="48" weight="duotone" />
          </div>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-label">Tankgröße</span>
            <span class="hero-stat-value">{{ currentVehicle.tankCapacityLiters }} L</span>
          </div>
          <div v-if="currentVehicle.avgConsumptionLPer100km" class="hero-stat">
            <span class="hero-stat-label">Ø Verbrauch</span>
            <span class="hero-stat-value consumption">
              {{ currentVehicle.avgConsumptionLPer100km }} L/100km
            </span>
          </div>
        </div>
      </div>

      <div v-if="currentVehicle && lastRefuel" class="card">
        <h2 class="card-title">Letzte Tankung</h2>
        <div class="refuel-summary">
          <div class="refuel-date">{{ formatDate(lastRefuel.date) }}</div>
          <div class="refuel-info">
            <span>{{ lastRefuel.liters }} L</span>
            <span>{{ formatPrice(lastRefuel.totalPrice) }} {{ currency }}</span>
            <span>{{ lastRefuel.odometerKm }} km</span>
          </div>
        </div>
      </div>

      <div v-if="currentVehicle" class="card consumption-card">
        <div class="card-header">
          <h2 class="card-title">Verbrauch</h2>
          <TrendUp :size="24" weight="duotone" class="card-icon" />
        </div>
        <div class="consumption-grid">
          <div class="consumption-item">
            <span class="consumption-label">Letzte 60 Tage</span>
            <div class="consumption-display">
              <span class="consumption-value">
                {{ currentVehicle.avgConsumptionLPer100km || '—' }}
              </span>
              <span class="consumption-unit">L/100km</span>
            </div>
          </div>
          <div v-if="quarterlyConsumption" class="consumption-item">
            <span class="consumption-label">Letztes Quartal</span>
            <div class="consumption-display">
              <span class="consumption-value quarterly">
                {{ quarterlyConsumption }}
              </span>
              <span class="consumption-unit">L/100km</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentVehicle && totalCosts > 0" class="card">
        <h2 class="card-title">Kostenübersicht</h2>
        <div class="costs-summary">
          <div class="cost-item">
            <span class="cost-label">Letzte 30 Tage</span>
            <span class="cost-value">{{ formatPrice(costs30Days) }} {{ currency }}</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Letzte 60 Tage</span>
            <span class="cost-value">{{ formatPrice(costs60Days) }} {{ currency }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { PhCar as Car, PhGasPump as GasPump, PhTrendUp as TrendUp } from '@phosphor-icons/vue'
import { loadVehicles, loadRefuels } from '../services/storageService'
import { loadSettings } from '../services/storageService'
import { getRefuelsByVehicleId } from '../services/storageService'
import { calculateQuarterlyConsumption } from '../services/consumptionService'

const vehicles = ref([])
const refuels = ref([])
const currency = ref('EUR')
const selectedVehicleId = ref(null)

// Automatische Fahrzeugauswahl: Wenn nur ein Fahrzeug existiert, wähle es automatisch
watch(vehicles, (newVehicles) => {
  if (newVehicles.length === 1 && !selectedVehicleId.value) {
    selectedVehicleId.value = newVehicles[0].id
  } else if (newVehicles.length > 0 && !selectedVehicleId.value) {
    selectedVehicleId.value = newVehicles[0].id
  }
}, { immediate: true })

const currentVehicle = computed(() => {
  if (!selectedVehicleId.value) return null
  return vehicles.value.find(v => v.id === selectedVehicleId.value) || null
})

const vehicleRefuels = computed(() => {
  if (!currentVehicle.value) return []
  return getRefuelsByVehicleIdSync(currentVehicle.value.id)
})

const quarterlyConsumption = computed(() => {
  if (!currentVehicle.value || vehicleRefuels.value.length < 2) return null
  return calculateQuarterlyConsumption(currentVehicle.value.id, vehicleRefuels.value)
})

const lastRefuel = computed(() => {
  if (vehicleRefuels.value.length === 0) return null
  return vehicleRefuels.value[0]
})

const costs30Days = computed(() => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return vehicleRefuels.value
    .filter(r => new Date(r.date) >= thirtyDaysAgo)
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0)
})

const costs60Days = computed(() => {
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  
  return vehicleRefuels.value
    .filter(r => new Date(r.date) >= sixtyDaysAgo)
    .reduce((sum, r) => sum + (r.totalPrice || 0), 0)
})

const totalCosts = computed(() => {
  return costs30Days.value + costs60Days.value
})

function getRefuelsByVehicleIdSync(vehicleId) {
  return refuels.value
    .filter(r => r.vehicleId === vehicleId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatPrice(price) {
  return price.toFixed(2)
}

onMounted(async () => {
  vehicles.value = await loadVehicles()
  refuels.value = await loadRefuels()
  
  const settings = await loadSettings()
  currency.value = settings.currency || 'EUR'
})
</script>

<style scoped>
.dashboard {
  width: 100%;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.vehicle-summary h3 {
  font-size: 1.5rem;
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.vehicle-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.consumption {
  color: var(--primary-color);
}

.refuel-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.refuel-date {
  font-weight: 600;
  color: var(--text-primary);
}

.refuel-info {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--text-secondary);
}

.consumption-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.consumption-value {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 4px var(--primary-glow));
}

.consumption-unit {
  font-size: 1.25rem;
  color: var(--text-secondary);
}

.consumption-note {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.costs-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cost-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--background);
  border-radius: var(--radius);
}

.cost-label {
  color: var(--text-secondary);
}

.cost-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state-small {
  text-align: center;
  padding: var(--spacing);
  color: var(--text-secondary);
}

.vehicle-selector {
  margin-bottom: var(--spacing);
}

.hero-card {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  margin-bottom: var(--spacing);
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing);
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: white;
}

.hero-subtitle {
  font-size: 0.95rem;
  opacity: 0.9;
  color: white;
}

.hero-icon {
  opacity: 0.3;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing);
  padding-top: var(--spacing);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 0.85rem;
  opacity: 0.8;
  color: white;
}

.hero-stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.hero-stat-value.consumption {
  color: var(--accent-light);
}

.consumption-card {
  margin-bottom: var(--spacing);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.card-icon {
  color: var(--primary-color);
  opacity: 0.6;
}

.consumption-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing);
}

.consumption-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--spacing);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
}

.consumption-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.consumption-value.quarterly {
  color: var(--primary-dark);
}
</style>

