<template>
  <div class="refuel-log-view">
    <div class="view-header">
      <h2>Tankbuch</h2>
      <button 
        class="btn btn-primary" 
        @click="showForm = true"
        aria-label="Neuen Tankvorgang hinzufügen"
      >
        <Plus :size="20" weight="bold" aria-hidden="true" />
        Tankvorgang hinzufügen
      </button>
    </div>

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
        <label class="form-label">Zeitraum</label>
        <select v-model="selectedPeriod" class="form-select">
          <option value="all">Alle</option>
          <option value="30">Letzte 30 Tage</option>
          <option value="60">Letzte 60 Tage</option>
          <option value="90">Letzte 90 Tage</option>
        </select>
      </div>
    </div>

    <RefuelList
      :refuels="filteredRefuels"
      @edit="handleEdit"
      @deleted="loadData"
    />

    <div v-if="showForm" class="modal-overlay" @click="closeForm">
      <div class="modal-content" @click.stop>
        <RefuelForm
          :vehicles="vehicles"
          :refuel="editingRefuel"
          @saved="handleSaved"
          @cancel="closeForm"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { PhPlus as Plus } from '@phosphor-icons/vue'
import RefuelList from '../components/RefuelList.vue'
import RefuelForm from '../components/RefuelForm.vue'
import { loadVehicles, loadRefuels } from '../services/storageService'
import { updateVehicleConsumption } from '../services/consumptionService'

const vehicles = ref([])
const refuels = ref([])
const showForm = ref(false)
const editingRefuel = ref(null)
const selectedVehicleId = ref('')
const selectedPeriod = ref('all')

const filteredRefuels = computed(() => {
  let filtered = [...refuels.value]

  // Filter nach Fahrzeug
  if (selectedVehicleId.value) {
    filtered = filtered.filter(r => r.vehicleId === selectedVehicleId.value)
  }

  // Filter nach Zeitraum
  if (selectedPeriod.value !== 'all') {
    const days = parseInt(selectedPeriod.value)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    filtered = filtered.filter(r => new Date(r.date) >= cutoffDate)
  }

  // Sortiere nach Datum absteigend
  return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
})

async function loadData() {
  vehicles.value = await loadVehicles()
  refuels.value = await loadRefuels()
  
  // Aktualisiere Verbrauch für alle Fahrzeuge
  for (const vehicle of vehicles.value) {
    const vehicleRefuels = refuels.value.filter(r => r.vehicleId === vehicle.id)
    const updatedVehicle = updateVehicleConsumption(vehicle, vehicleRefuels)
    if (updatedVehicle.avgConsumptionLPer100km !== vehicle.avgConsumptionLPer100km) {
      await import('../services/storageService').then(m => m.upsertVehicle(updatedVehicle))
    }
  }
  
  vehicles.value = await loadVehicles()
}

function handleEdit(refuel) {
  editingRefuel.value = refuel
  showForm.value = true
}

async function handleSaved() {
  await loadData()
  closeForm()
}

function closeForm() {
  showForm.value = false
  editingRefuel.value = null
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.refuel-log-view {
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

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing);
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
  padding: var(--spacing);
  max-width: 90vw;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
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

  .filters {
    grid-template-columns: 1fr;
  }
}
</style>

