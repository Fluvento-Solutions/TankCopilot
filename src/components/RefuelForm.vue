<template>
  <div class="refuel-form">
    <h2 v-if="!refuel">Neuer Tankvorgang</h2>
    <h2 v-else>Tankvorgang bearbeiten</h2>
    
    <form @submit.prevent="handleSubmit">
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

      <div class="form-group">
        <label class="form-label">Datum</label>
        <input
          v-model="formData.date"
          type="date"
          class="form-input"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Kilometerstand (km)</label>
        <input
          v-model.number="formData.odometerKm"
          type="number"
          class="form-input"
          :class="{ 'input-error': odometerError }"
          :placeholder="lastOdometerKm ? `Letzter Stand: ${lastOdometerKm} km` : 'z.B. 50000'"
          min="0"
          step="1"
          required
          @blur="validateOdometer"
          @input="validateOdometer"
        />
        <div v-if="odometerError" class="error-message">
          {{ odometerError }}
        </div>
        <div v-if="lastOdometerKm && !odometerError" class="form-hint">
          Letzter Stand: {{ lastOdometerKm }} km
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Getankte Liter</label>
        <input
          v-model.number="formData.liters"
          type="number"
          class="form-input"
          placeholder="z.B. 45.5"
          min="0"
          step="0.1"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Preis pro Liter ({{ currency }})</label>
        <div class="price-input-container">
          <span class="price-prefix">1,</span>
          <select
            v-model.number="priceDigit1"
            class="price-digit-select"
            @change="updatePricePerLiter"
          >
            <option v-for="i in 10" :key="i" :value="i - 1">{{ i - 1 }}</option>
          </select>
          <select
            v-model.number="priceDigit2"
            class="price-digit-select"
            @change="updatePricePerLiter"
          >
            <option v-for="i in 10" :key="i" :value="i - 1">{{ i - 1 }}</option>
          </select>
          <span class="price-suffix"><sup>9</sup></span>
          <span class="price-unit">EUR</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Gesamtpreis ({{ currency }})</label>
        <input
          v-model.number="formData.totalPrice"
          type="number"
          class="form-input"
          placeholder="Wird automatisch berechnet"
          min="0"
          step="0.01"
        />
        <small class="form-hint">Wird automatisch aus Liter × Preis berechnet</small>
      </div>

      <div class="form-group">
        <div class="form-checkbox">
          <input
            v-model="formData.isFullTank"
            type="checkbox"
            id="isFullTank"
          />
          <label for="isFullTank">Vollgetankt</label>
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
          aria-label="Tankvorgang speichern"
        >
          Speichern
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { upsertRefuel, getRefuelsByVehicleId } from '../services/storageService'
import { loadSettings } from '../services/storageService'

const props = defineProps({
  vehicles: {
    type: Array,
    required: true
  },
  refuel: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['saved', 'cancel'])

const currency = ref('EUR')

const formData = ref({
  vehicleId: '',
  date: new Date().toISOString().split('T')[0],
  odometerKm: 0,
  liters: 0,
  pricePerLiter: 0,
  totalPrice: 0,
  isFullTank: false
})

// Preis-Eingabe mit Format 1,XX9
const priceDigit1 = ref(8)
const priceDigit2 = ref(5)

const lastOdometerKm = ref(null)
const odometerError = ref('')

function updatePricePerLiter() {
  // Berechne Preis: 1.XX9 = 1 + (digit1/10) + (digit2/100) + 0.009
  formData.value.pricePerLiter = 1 + (priceDigit1.value / 10) + (priceDigit2.value / 100) + 0.009
}

// Lade letzten Kilometerstand für das ausgewählte Fahrzeug
async function loadLastOdometer(vehicleId) {
  if (!vehicleId) {
    lastOdometerKm.value = null
    return
  }
  
  const refuels = await getRefuelsByVehicleId(vehicleId)
  if (refuels.length > 0) {
    // Beim Bearbeiten: Ignoriere den aktuellen Eintrag
    const filteredRefuels = props.refuel 
      ? refuels.filter(r => r.id !== props.refuel.id)
      : refuels
    
    if (filteredRefuels.length > 0) {
      // Sortiere nach Kilometerstand (höchster zuerst)
      const sortedRefuels = [...filteredRefuels].sort((a, b) => b.odometerKm - a.odometerKm)
      lastOdometerKm.value = sortedRefuels[0].odometerKm
      
      // Setze einen Wert der höher ist, damit der Nutzer ihn ändern muss
      // Nur wenn kein bestehender Wert vorhanden ist oder beim neuen Eintrag
      if (!props.refuel || !props.refuel.odometerKm || formData.value.odometerKm === 0) {
        formData.value.odometerKm = lastOdometerKm.value + 1
      }
    } else {
      lastOdometerKm.value = null
    }
  } else {
    lastOdometerKm.value = null
  }
}

// Validiere Kilometerstand
function validateOdometer() {
  odometerError.value = ''
  
  if (!formData.value.vehicleId) {
    return true
  }
  
  if (lastOdometerKm.value !== null) {
    if (formData.value.odometerKm <= lastOdometerKm.value) {
      odometerError.value = `Kilometerstand muss höher sein als der letzte Stand (${lastOdometerKm.value} km)`
      return false
    }
  }
  
  return true
}

// Lade Settings für Währung
loadSettings().then(settings => {
  currency.value = settings.currency || 'EUR'
})

watch(() => props.refuel, (newRefuel) => {
  if (newRefuel) {
    formData.value = {
      vehicleId: newRefuel.vehicleId || '',
      date: newRefuel.date ? newRefuel.date.split('T')[0] : new Date().toISOString().split('T')[0],
      odometerKm: newRefuel.odometerKm || 0,
      liters: newRefuel.liters || 0,
      pricePerLiter: newRefuel.pricePerLiter || 0,
      totalPrice: newRefuel.totalPrice || 0,
      isFullTank: newRefuel.isFullTank || false
    }
    // Extrahiere Ziffern aus Preis (Format: 1.XX9)
    if (newRefuel.pricePerLiter) {
      const priceStr = newRefuel.pricePerLiter.toFixed(3)
      const parts = priceStr.split('.')
      if (parts.length === 2) {
        const decimals = parts[1]
        priceDigit1.value = parseInt(decimals[0]) || 8
        priceDigit2.value = parseInt(decimals[1]) || 5
      }
    }
    // Lade letzten Kilometerstand (ohne den aktuellen Eintrag)
    if (newRefuel.vehicleId) {
      loadLastOdometer(newRefuel.vehicleId)
    }
  } else {
    formData.value = {
      vehicleId: '',
      date: new Date().toISOString().split('T')[0],
      odometerKm: 0,
      liters: 0,
      pricePerLiter: 0,
      totalPrice: 0,
      isFullTank: false
    }
    priceDigit1.value = 8
    priceDigit2.value = 5
    updatePricePerLiter()
    lastOdometerKm.value = null
    odometerError.value = ''
  }
}, { immediate: true })

// Lade letzten Kilometerstand wenn Fahrzeug geändert wird
watch(() => formData.value.vehicleId, async (newVehicleId) => {
  if (newVehicleId) {
    await loadLastOdometer(newVehicleId)
  } else {
    lastOdometerKm.value = null
  }
}, { immediate: true })

// Berechne totalPrice automatisch
watch([() => formData.value.liters, () => formData.value.pricePerLiter], ([liters, pricePerLiter]) => {
  if (liters > 0 && pricePerLiter > 0) {
    formData.value.totalPrice = Math.round(liters * pricePerLiter * 100) / 100
  }
})

async function handleSubmit() {
  // Validiere Kilometerstand vor dem Speichern
  if (!validateOdometer()) {
    return
  }
  
  try {
    const refuelData = {
      ...(props.refuel || {}),
      ...formData.value,
      date: new Date(formData.value.date).toISOString()
    }
    
    await upsertRefuel(refuelData)
    emit('saved')
  } catch (error) {
    console.error('Fehler beim Speichern des Tankvorgangs:', error)
    alert('Fehler beim Speichern des Tankvorgangs')
  }
}
</script>

<style scoped>
.refuel-form {
  max-width: 500px;
  margin: 0 auto;
}

.refuel-form h2 {
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.price-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border: 0.5px solid var(--border);
  border-radius: var(--radius-small);
  background: var(--surface);
  transition: all 0.2s;
}

.price-input-container:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
}

.price-prefix {
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
}

.price-digit-select {
  padding: 8px 12px;
  border: 0.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 17px;
  font-weight: 600;
  background: var(--surface-secondary);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 60px;
  text-align: center;
}

.price-digit-select:focus {
  outline: none;
  border-color: var(--primary-color);
  background: var(--surface);
}

.price-suffix {
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
}

.price-suffix sup {
  font-size: 0.7em;
  vertical-align: super;
  line-height: 0;
}

.price-unit {
  font-size: 15px;
  color: var(--text-secondary);
  margin-left: auto;
}

.input-error {
  border-color: #ff3b30 !important;
  box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.15) !important;
  background: rgba(255, 59, 48, 0.05) !important;
}

.error-message {
  margin-top: 6px;
  padding: 10px 14px;
  background: rgba(255, 59, 48, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #c62828;
  border-radius: var(--radius-small);
  border: 1px solid rgba(255, 59, 48, 0.2);
  font-size: 0.875rem;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  gap: var(--spacing);
  margin-top: calc(var(--spacing) * 1.5);
}

.form-actions .btn {
  flex: 1;
}
</style>

