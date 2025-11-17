<template>
  <div class="trip-list">
    <div v-if="trips.length === 0" class="empty-state">
      <p>Noch keine Fahrten erfasst.</p>
    </div>

    <div v-else class="trip-items">
      <div
        v-for="trip in trips"
        :key="trip.id"
        class="trip-item"
        :class="{ active: trip.status === 'active', paused: trip.status === 'paused' }"
      >
        <div class="trip-header">
          <div class="trip-title">
            <h3>{{ trip.name || 'Unbenannte Fahrt' }}</h3>
            <span class="trip-date">{{ formatDate(trip.startDate) }}</span>
          </div>
          <span class="trip-status-badge" :class="trip.status">
            {{ getStatusText(trip.status) }}
          </span>
        </div>

        <div class="trip-details">
          <div class="detail-item">
            <Navigation :size="16" weight="bold" aria-hidden="true" />
            <span>{{ formatDistance(trip.distanceKm) }}</span>
          </div>
          <div class="detail-item">
            <Clock :size="16" weight="bold" aria-hidden="true" />
            <span>{{ formatDuration(trip.durationSeconds) }}</span>
          </div>
          <div class="detail-item" v-if="trip.avgSpeedKmh">
            <Gauge :size="16" weight="bold" aria-hidden="true" />
            <span>{{ Math.round(trip.avgSpeedKmh) }} km/h</span>
            <span v-if="trip.maxSpeedKmh" class="speed-max">(max: {{ Math.round(trip.maxSpeedKmh) }})</span>
          </div>
          <div class="detail-item" v-if="trip.vehicleId && getVehicleName(trip.vehicleId)">
            <Car :size="16" weight="bold" aria-hidden="true" />
            <span>{{ getVehicleName(trip.vehicleId) }}</span>
          </div>
        </div>

        <div class="trip-actions">
          <button
            v-if="trip.status === 'completed'"
            class="btn-icon"
            @click="$emit('edit', trip)"
            aria-label="Fahrt bearbeiten"
          >
            <Pencil :size="18" weight="bold" aria-hidden="true" />
          </button>
          <button
            class="btn-icon btn-danger"
            @click="$emit('delete', trip.id)"
            aria-label="Fahrt löschen"
          >
            <Trash :size="18" weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PhNavigationArrow as Navigation, PhClock as Clock, PhCar as Car, PhPencil as Pencil, PhTrash as Trash, PhGauge as Gauge } from '@phosphor-icons/vue'
import { formatDuration, formatDistance } from '../services/tripService'
import { loadVehicles } from '../services/storageService'
import { ref, onMounted } from 'vue'

const props = defineProps({
  trips: {
    type: Array,
    required: true
  }
})

defineEmits(['edit', 'delete'])

const vehicles = ref([])

function formatDate(dateString) {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Heute, ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Gestern, ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

function getStatusText(status) {
  const statusMap = {
    'active': 'Aktiv',
    'paused': 'Pausiert',
    'completed': 'Abgeschlossen'
  }
  return statusMap[status] || status
}

function getVehicleName(vehicleId) {
  const vehicle = vehicles.value.find(v => v.id === vehicleId)
  return vehicle ? vehicle.name : null
}

onMounted(async () => {
  vehicles.value = await loadVehicles()
})
</script>

<style scoped>
.trip-list {
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-large);
  color: var(--text-secondary);
}

.trip-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
}

.trip-item {
  background: var(--surface);
  border-radius: var(--radius);
  padding: var(--spacing);
  box-shadow: var(--shadow);
  transition: all 0.2s;
}

.trip-item:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}

.trip-item.active {
  border-left: 4px solid var(--primary-color);
}

.trip-item.paused {
  border-left: 4px solid var(--color-warning, #ed8936);
}

.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-small);
}

.trip-title h3 {
  margin: 0 0 4px 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.trip-date {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.trip-status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.trip-status-badge.active {
  background: rgba(0, 168, 168, 0.1);
  color: var(--primary-color);
}

.trip-status-badge.paused {
  background: rgba(237, 137, 54, 0.1);
  color: var(--color-warning, #ed8936);
}

.trip-status-badge.completed {
  background: rgba(74, 222, 128, 0.1);
  color: var(--color-success, #4ade80);
}

.trip-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing);
  margin-bottom: var(--spacing-small);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.speed-max {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-left: 4px;
}

.trip-actions {
  display: flex;
  gap: var(--spacing-small);
  justify-content: flex-end;
  padding-top: var(--spacing-small);
  border-top: 1px solid var(--border-light);
}

.btn-icon {
  background: transparent;
  border: none;
  padding: 8px;
  border-radius: var(--radius-small);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.btn-icon.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>

