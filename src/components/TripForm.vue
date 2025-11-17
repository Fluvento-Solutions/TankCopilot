<template>
  <div class="trip-form">
    <h2 v-if="!trip">Neue Fahrt</h2>
    <h2 v-else>Fahrt bearbeiten</h2>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="form-label">Name (optional)</label>
        <input
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="z.B. Fahrt nach München"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Fahrzeug</label>
        <select v-model="formData.vehicleId" class="form-select" required>
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

      <div class="form-group" v-if="trip && trip.status === 'completed'">
        <label class="form-label">Startdatum</label>
        <input
          v-model="formData.startDate"
          type="datetime-local"
          class="form-input"
          required
        />
      </div>

      <div class="form-group" v-if="trip && trip.status === 'completed'">
        <label class="form-label">Enddatum</label>
        <input
          v-model="formData.endDate"
          type="datetime-local"
          class="form-input"
        />
      </div>

      <div class="form-group" v-if="trip && trip.status === 'completed'">
        <label class="form-label">Strecke (km)</label>
        <input
          v-model="formData.distanceKm"
          type="text"
          class="form-input"
          placeholder="z.B. 15.5 oder 15,5"
          @input="handleDistanceInput"
        />
      </div>

      <div class="form-group" v-if="trip && trip.status === 'completed'">
        <label class="form-label">Dauer (Sekunden)</label>
        <input
          v-model.number="formData.durationSeconds"
          type="number"
          class="form-input"
          step="1"
          min="0"
          placeholder="0"
        />
        <div class="form-hint">
          {{ formData.durationSeconds ? formatDuration(formData.durationSeconds) : '' }}
        </div>
      </div>

      <div class="form-actions">
        <button 
          type="button" 
          class="btn btn-secondary" 
          @click="$emit('cancel')"
          aria-label="Formular abbrechen"
        >
          Abbrechen
        </button>
        <button 
          v-if="!trip"
          type="submit"
          class="btn btn-primary"
          aria-label="Fahrt erstellen und starten"
        >
          Erstellen & Starten
        </button>
        <button 
          v-else
          type="submit"
          class="btn btn-primary"
          aria-label="Fahrt speichern"
        >
          Speichern
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { formatDuration } from '../services/tripService'
import { parseDecimal, normalizeDecimalInput } from '../utils/numberUtils'

const props = defineProps({
  vehicles: {
    type: Array,
    required: true
  },
  trip: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['saved', 'cancel'])

const formData = ref({
  name: '',
  vehicleId: '',
  startDate: '',
  endDate: '',
  distanceKm: 0,
  durationSeconds: 0
})

watch(() => props.trip, (newTrip) => {
  if (newTrip) {
    // Konvertiere ISO-Datumsstrings zu datetime-local Format
    const startDate = newTrip.startDate ? new Date(newTrip.startDate).toISOString().slice(0, 16) : ''
    const endDate = newTrip.endDate ? new Date(newTrip.endDate).toISOString().slice(0, 16) : ''
    
    formData.value = {
      name: newTrip.name || '',
      vehicleId: newTrip.vehicleId || '',
      startDate: startDate,
      endDate: endDate,
      distanceKm: newTrip.distanceKm || 0,
      durationSeconds: newTrip.durationSeconds || 0
    }
  } else {
    formData.value = {
      name: '',
      vehicleId: '',
      startDate: '',
      endDate: '',
      distanceKm: 0,
      durationSeconds: 0
    }
  }
}, { immediate: true })

function handleDistanceInput(event) {
  const value = normalizeDecimalInput(event.target.value)
  const numValue = parseDecimal(value)
  
  if (!isNaN(numValue) && numValue >= 0) {
    formData.value.distanceKm = numValue
  } else if (value === '' || value === null) {
    formData.value.distanceKm = 0
  }
}

async function handleSubmit() {
  try {
    const tripData = {
      ...(props.trip || {}),
      ...formData.value
    }

    // Konvertiere datetime-local zurück zu ISO
    if (tripData.startDate) {
      tripData.startDate = new Date(tripData.startDate).toISOString()
    }
    if (tripData.endDate) {
      tripData.endDate = new Date(tripData.endDate).toISOString()
    }

    // Parse Dezimalwerte (können Strings mit Komma sein)
    if (typeof tripData.distanceKm === 'string') {
      tripData.distanceKm = parseDecimal(tripData.distanceKm) || 0
    }

    // Wenn neue Fahrt, setze Status auf 'active' (wird gestartet)
    if (!props.trip) {
      tripData.status = 'active'
    }

    emit('saved', tripData)
  } catch (error) {
    console.error('Fehler beim Speichern der Fahrt:', error)
    alert('Fehler beim Speichern der Fahrt')
  }
}
</script>

<style scoped>
.trip-form {
  max-width: 500px;
  margin: 0 auto;
  padding: var(--spacing);
}

.trip-form h2 {
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.form-actions {
  display: flex;
  gap: var(--spacing);
  margin-top: calc(var(--spacing) * 1.5);
}

.form-actions .btn {
  flex: 1;
}

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>

