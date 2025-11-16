<template>
  <div class="station-list">
    <div v-if="stations.length === 0" class="empty-state">
      <MapPin :size="64" weight="duotone" class="empty-state-icon" />
      <p>Keine Tankstellen gefunden</p>
    </div>

    <div v-else>
      <div
        v-for="station in sortedStations"
        :key="station.id"
        class="list-item station-item"
      >
        <div class="station-header">
          <div class="station-name-section">
            <h3 class="station-name">{{ station.name }}</h3>
            <div v-if="station.street || station.city" class="station-location">
              {{ formatStationAddress(station) }}
            </div>
            <div v-if="station.isSB" class="station-badge sb">
              SB-Tankstelle
            </div>
          </div>
          <div class="station-price">
            {{ formatPricePerLiter(station.pricePerLiter) }} {{ currency }}/L
          </div>
        </div>

        <div class="station-details">
          <div class="station-detail">
            <Ruler :size="20" weight="regular" class="detail-icon" />
            <span>Hin & Zurück: {{ (station.roundTripDistanceKm || station.distanceKm * 2).toFixed(1) }} km</span>
          </div>
          <div class="station-detail">
            <Clock :size="20" weight="regular" class="detail-icon" />
            <span>{{ Math.round(station.durationMinutes) }} Min</span>
          </div>
          <div class="station-detail">
            <CurrencyEur :size="20" weight="regular" class="detail-icon" />
            <span>Tanken: {{ formatPrice(station.costAtStation) }} {{ currency }}</span>
          </div>
        </div>

        <div class="station-trip-info">
          <div class="trip-info-item">
            <span class="trip-label">Spritverbrauch (Hin & Zurück):</span>
            <span class="trip-value">{{ formatFuelConsumption(station.roundTripFuelConsumptionLiters || 0) }} L</span>
          </div>
          <div class="trip-info-item">
            <span class="trip-label">Fahrtkosten (Hin & Zurück):</span>
            <span class="trip-value">{{ formatPrice(station.roundTripCost || 0) }} {{ currency }}</span>
          </div>
        </div>

        <div v-if="station.netSavingComparedToRef > 0" class="station-savings positive">
          💵 Netto-Ersparnis: {{ formatPrice(station.netSavingComparedToRef) }} {{ currency }}
          <span class="savings-note">(inkl. Fahrtkosten)</span>
        </div>
        <div v-else-if="station.netSavingComparedToRef < 0" class="station-savings negative">
          ⚠️ Netto-Mehrkosten: {{ formatPrice(Math.abs(station.netSavingComparedToRef)) }} {{ currency }}
          <span class="savings-note">(inkl. Fahrtkosten)</span>
        </div>
        <div v-else-if="station.savingComparedToRef > 0" class="station-savings neutral">
          ℹ️ Brutto-Ersparnis: {{ formatPrice(station.savingComparedToRef) }} {{ currency }}
          <span class="savings-note">(ohne Fahrtkosten)</span>
        </div>

        <button
          class="btn btn-primary station-navigate"
          @click="startNavigation(station)"
          :aria-label="`Navigation zu ${station.name} starten`"
        >
          <NavigationArrow :size="20" weight="bold" aria-hidden="true" />
          Navigation starten
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { PhMapPin as MapPin, PhNavigationArrow as NavigationArrow, PhRuler as Ruler, PhClock as Clock, PhCurrencyEur as CurrencyEur } from '@phosphor-icons/vue'
import { getNavigationUrl, formatStationAddress } from '../services/fuelStationService'
import { loadSettings } from '../services/storageService'

const props = defineProps({
  stations: {
    type: Array,
    required: true
  }
})

const currency = ref('EUR')
const preferredNavApp = ref('auto')

loadSettings().then(settings => {
  currency.value = settings.currency || 'EUR'
  preferredNavApp.value = settings.preferredNavigationApp || 'auto'
})

const sortedStations = computed(() => {
  return [...props.stations].sort((a, b) => {
    // Primär: Netto-Ersparnis (absteigend) - wenn verfügbar
    if (a.netSavingComparedToRef !== undefined && b.netSavingComparedToRef !== undefined) {
      if (b.netSavingComparedToRef !== a.netSavingComparedToRef) {
        return b.netSavingComparedToRef - a.netSavingComparedToRef
      }
    }
    // Sekundär: Brutto-Ersparnis (absteigend)
    if (b.savingComparedToRef !== a.savingComparedToRef) {
      return b.savingComparedToRef - a.savingComparedToRef
    }
    // Tertiär: Distanz (aufsteigend)
    return a.distanceKm - b.distanceKm
  })
})

function formatPrice(price) {
  return price.toFixed(2)
}

function formatPricePerLiter(price) {
  return price.toFixed(3)
}

function formatFuelConsumption(liters) {
  return liters.toFixed(3)
}

async function startNavigation(station) {
  const settings = await loadSettings()
  const appName = settings.preferredNavigationApp || 'auto'
  const url = getNavigationUrl(station, appName)
  if (url) {
    window.open(url, '_blank')
  }
}
</script>

<style scoped>
.station-list {
  width: 100%;
}

.station-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.station-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing);
  position: relative;
  z-index: 1;
}

.station-name-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.station-name {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  line-height: 1.3;
}

.station-location {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.station-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-top: 4px;
  width: fit-content;
}

.station-badge.sb {
  background: var(--primary-light);
  color: var(--primary-color);
}

.station-price {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--primary-color);
  text-align: right;
}

.station-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  background: var(--background);
  border-radius: var(--radius);
  position: relative;
  z-index: 1;
}

.station-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.detail-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.station-savings {
  padding: 12px;
  border-radius: var(--radius);
  font-weight: 600;
  text-align: center;
  position: relative;
  z-index: 1;
}

.station-savings.positive {
  background: rgba(0, 168, 168, 0.15);
  color: var(--primary-dark);
  border: 1px solid rgba(0, 168, 168, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.station-savings.negative {
  background: rgba(255, 59, 48, 0.15);
  color: #c62828;
  border: 1px solid rgba(255, 59, 48, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.station-savings.neutral {
  background: rgba(128, 128, 128, 0.15);
  color: var(--text-secondary);
  border: 1px solid rgba(128, 128, 128, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.savings-note {
  display: block;
  font-size: 0.85rem;
  font-weight: 400;
  margin-top: 4px;
  opacity: 0.8;
}

.station-trip-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--surface-secondary);
  border-radius: var(--radius-small);
  margin-top: 8px;
  position: relative;
  z-index: 1;
}

.trip-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.trip-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.trip-value {
  color: var(--text-primary);
  font-weight: 600;
}

.station-navigate {
  width: 100%;
  margin-top: 8px;
  position: relative;
  z-index: 1;
}

@media (max-width: 600px) {
  .station-header {
    flex-direction: column;
  }

  .station-price {
    font-size: 1.25rem;
  }
}
</style>

