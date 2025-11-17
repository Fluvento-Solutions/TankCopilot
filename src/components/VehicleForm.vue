<template>
  <div class="vehicle-form">
    <h2 v-if="!vehicle">Neues Fahrzeug</h2>
    <h2 v-else>Fahrzeug bearbeiten</h2>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input
          v-model="formData.name"
          type="text"
          class="form-input"
          placeholder="z.B. Golf, Familienauto"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Kraftstoffart</label>
        <select v-model="formData.fuelType" class="form-select" required>
          <option value="E5">Super E5</option>
          <option value="E10">Super E10</option>
          <option value="Diesel">Diesel</option>
          <option value="LPG">LPG (Autogas)</option>
          <option value="CNG">CNG (Erdgas)</option>
          <option value="H2">Wasserstoff (H2)</option>
          <option value="Elektro">Elektro</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tankgröße (Liter)</label>
        <input
          v-model.number="formData.tankCapacityLiters"
          type="number"
          class="form-input"
          placeholder="z.B. 50"
          min="1"
          step="0.1"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Aktueller Kilometerstand (km)</label>
        <input
          v-model.number="formData.currentOdometerKm"
          type="number"
          class="form-input"
          placeholder="z.B. 50000"
          min="0"
          step="1"
        />
        <div class="form-hint">
          Optional: Aktueller Kilometerstand des Fahrzeugs
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Geschätzter Verbrauch (L/100km)</label>
        <input
          v-model="formData.estimatedConsumptionLPer100km"
          type="text"
          class="form-input"
          placeholder="z.B. 7.5 oder 7,5"
          @input="handleConsumptionInput"
        />
        <div class="form-hint">
          Optional: Geschätzter Verbrauch für Fahrtkosten-Berechnung. Wird automatisch durch echte Verbrauchsdaten ersetzt, sobald genug Tankvorgänge vorhanden sind.
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
          type="submit" 
          class="btn btn-primary"
          aria-label="Fahrzeug speichern"
        >
          Speichern
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { upsertVehicle } from '../services/storageService'
import { parseDecimal, normalizeDecimalInput } from '../utils/numberUtils'

const props = defineProps({
  vehicle: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['saved', 'cancel'])

const formData = ref({
  name: '',
  fuelType: 'E5',
  tankCapacityLiters: 50,
  currentOdometerKm: null,
  estimatedConsumptionLPer100km: null
})

watch(() => props.vehicle, (newVehicle) => {
  if (newVehicle) {
    formData.value = {
      name: newVehicle.name || '',
      fuelType: newVehicle.fuelType || 'E5',
      tankCapacityLiters: newVehicle.tankCapacityLiters || 50,
      currentOdometerKm: newVehicle.currentOdometerKm || null,
      estimatedConsumptionLPer100km: newVehicle.estimatedConsumptionLPer100km || null
    }
  } else {
    formData.value = {
      name: '',
      fuelType: 'E5',
      tankCapacityLiters: 50,
      currentOdometerKm: null,
      estimatedConsumptionLPer100km: null
    }
  }
}, { immediate: true })

function handleConsumptionInput(event) {
  const value = normalizeDecimalInput(event.target.value)
  const numValue = parseDecimal(value)
  
  if (!isNaN(numValue) && numValue > 0) {
    formData.value.estimatedConsumptionLPer100km = numValue
  } else if (value === '' || value === null) {
    formData.value.estimatedConsumptionLPer100km = null
  } else {
    // Behalte den String-Wert für die Anzeige, wird beim Submit geparst
    formData.value.estimatedConsumptionLPer100km = value
  }
}

async function handleSubmit() {
  try {
    const vehicleData = {
      ...(props.vehicle || {}),
      ...formData.value
    }
    
    // Stelle sicher, dass currentOdometerKm null ist, wenn leer (nicht 0, da 0 ein gültiger Wert sein kann)
    if (vehicleData.currentOdometerKm === '' || vehicleData.currentOdometerKm === undefined) {
      vehicleData.currentOdometerKm = null
    }
    
    // Parse estimatedConsumptionLPer100km (kann String mit Komma sein)
    if (typeof vehicleData.estimatedConsumptionLPer100km === 'string') {
      const parsed = parseDecimal(vehicleData.estimatedConsumptionLPer100km)
      vehicleData.estimatedConsumptionLPer100km = (!isNaN(parsed) && parsed > 0) ? parsed : null
    } else if (vehicleData.estimatedConsumptionLPer100km === '' || vehicleData.estimatedConsumptionLPer100km === undefined || vehicleData.estimatedConsumptionLPer100km <= 0) {
      vehicleData.estimatedConsumptionLPer100km = null
    }
    
    await upsertVehicle(vehicleData)
    emit('saved')
  } catch (error) {
    console.error('Fehler beim Speichern des Fahrzeugs:', error)
    alert('Fehler beim Speichern des Fahrzeugs')
  }
}
</script>

<style scoped>
.vehicle-form {
  max-width: 500px;
  margin: 0 auto;
}

.vehicle-form h2 {
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

