<template>
  <div class="refuel-list">
    <div v-if="refuels.length === 0" class="empty-state">
      <GasPump :size="64" weight="duotone" class="empty-state-icon" />
      <p>Noch keine Tankvorgänge vorhanden</p>
      <p class="empty-state-hint">Erfassen Sie Ihren ersten Tankvorgang</p>
    </div>

    <div v-else>
      <div
        v-for="refuel in refuels"
        :key="refuel.id"
        class="list-item refuel-item"
      >
        <div class="refuel-header">
          <div class="refuel-date">{{ formatDate(refuel.date) }}</div>
          <div class="refuel-actions">
            <button
              class="btn btn-secondary"
              @click="$emit('edit', refuel)"
              :aria-label="`Tankvorgang vom ${formatDate(refuel.date)} bearbeiten`"
            >
              <Pencil :size="18" weight="regular" aria-hidden="true" />
              Bearbeiten
            </button>
            <button
              class="btn btn-danger"
              @click="handleDelete(refuel.id)"
              :aria-label="`Tankvorgang vom ${formatDate(refuel.date)} löschen`"
            >
              <Trash :size="18" weight="regular" aria-hidden="true" />
              Löschen
            </button>
          </div>
        </div>
        <div class="refuel-details">
          <div class="refuel-detail">
            <span class="detail-label">Liter:</span>
            <span class="detail-value">{{ refuel.liters }} L</span>
          </div>
          <div class="refuel-detail">
            <span class="detail-label">Preis/L:</span>
            <span class="detail-value">{{ formatPricePerLiter(refuel.pricePerLiter) }} {{ currency }}</span>
          </div>
          <div class="refuel-detail">
            <span class="detail-label">Gesamt:</span>
            <span class="detail-value">{{ formatPrice(refuel.totalPrice) }} {{ currency }}</span>
          </div>
          <div class="refuel-detail">
            <span class="detail-label">Kilometerstand:</span>
            <span class="detail-value">{{ refuel.odometerKm }} km</span>
          </div>
          <div v-if="refuel.isFullTank" class="refuel-badge">
            Vollgetankt
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { PhGasPump as GasPump, PhPencil as Pencil, PhTrash as Trash } from '@phosphor-icons/vue'
import { deleteRefuel } from '../services/storageService'
import { loadSettings } from '../services/storageService'

const props = defineProps({
  refuels: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['edit', 'deleted'])

const currency = ref('EUR')

loadSettings().then(settings => {
  currency.value = settings.currency || 'EUR'
})

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

function formatPricePerLiter(price) {
  return price.toFixed(3)
}

async function handleDelete(refuelId) {
  if (!confirm('Möchten Sie diesen Tankvorgang wirklich löschen?')) {
    return
  }

  try {
    await deleteRefuel(refuelId)
    emit('deleted')
  } catch (error) {
    console.error('Fehler beim Löschen des Tankvorgangs:', error)
    alert('Fehler beim Löschen des Tankvorgangs')
  }
}
</script>

<style scoped>
.refuel-list {
  width: 100%;
}

.refuel-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.refuel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refuel-date {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1.1rem;
}

.refuel-actions {
  display: flex;
  gap: 8px;
}

.refuel-actions .btn {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.refuel-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.refuel-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.detail-value {
  font-weight: 600;
  color: var(--text-primary);
}

.refuel-badge {
  display: inline-block;
  padding: 4px 8px;
  background: var(--primary-color);
  color: white;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-top: 8px;
}

@media (max-width: 600px) {
  .refuel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .refuel-actions {
    width: 100%;
  }

  .refuel-actions .btn {
    flex: 1;
  }
}
</style>

