<template>
  <div class="vehicle-list">
    <div v-if="vehicles.length === 0" class="empty-state">
      <Car :size="64" weight="duotone" class="empty-state-icon" />
      <p>Noch keine Fahrzeuge vorhanden</p>
      <p class="empty-state-hint">Fügen Sie Ihr erstes Fahrzeug hinzu</p>
    </div>

    <div v-else>
      <div
        v-for="vehicle in vehicles"
        :key="vehicle.id"
        class="list-item vehicle-item"
      >
        <div class="vehicle-info">
          <h3 class="vehicle-name">{{ vehicle.name }}</h3>
          <div class="vehicle-details">
            <span class="vehicle-detail">{{ vehicle.fuelType }}</span>
            <span class="vehicle-detail">{{ vehicle.tankCapacityLiters }} L</span>
            <span
              v-if="vehicle.avgConsumptionLPer100km"
              class="vehicle-detail consumption"
            >
              ⛽ {{ vehicle.avgConsumptionLPer100km }} L/100km
            </span>
            <span v-else class="vehicle-detail consumption">
              ⛽ Noch keine Daten
            </span>
          </div>
        </div>
        <div class="vehicle-actions">
          <button
            class="btn btn-secondary"
            @click="$emit('edit', vehicle)"
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
</template>

<script setup>
import { PhCar as Car, PhPencil as Pencil, PhTrash as Trash } from '@phosphor-icons/vue'
import { deleteVehicle } from '../services/storageService'

defineProps({
  vehicles: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['edit', 'deleted'])

async function handleDelete(vehicleId) {
  if (!confirm('Möchten Sie dieses Fahrzeug wirklich löschen?')) {
    return
  }

  try {
    await deleteVehicle(vehicleId)
    emit('deleted')
  } catch (error) {
    console.error('Fehler beim Löschen des Fahrzeugs:', error)
    alert('Fehler beim Löschen des Fahrzeugs')
  }
}
</script>

<style scoped>
.vehicle-list {
  width: 100%;
}

.vehicle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing);
}

.vehicle-info {
  flex: 1;
}

.vehicle-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.vehicle-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.vehicle-detail {
  padding: 4px 8px;
  background: var(--background);
  border-radius: 6px;
}

.vehicle-detail.consumption {
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-light);
  border: 1px solid rgba(0, 168, 168, 0.2);
}

.vehicle-actions {
  display: flex;
  gap: 8px;
}

.vehicle-actions .btn {
  padding: 8px 16px;
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .vehicle-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .vehicle-actions {
    width: 100%;
  }

  .vehicle-actions .btn {
    flex: 1;
  }
}
</style>

