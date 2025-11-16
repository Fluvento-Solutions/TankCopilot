<template>
  <div class="location-input">
    <div class="location-header">
      <h3>Standort manuell eingeben</h3>
      <p class="location-hint">
        GPS konnte nicht verwendet werden. Bitte geben Sie Ihren Standort manuell ein.
      </p>
    </div>
    
    <div class="location-form">
      <div class="form-group">
        <label for="street">Straße und Hausnummer</label>
        <input
          id="street"
          v-model="formData.street"
          type="text"
          placeholder="z.B. Musterstraße 123"
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label for="postalCode">Postleitzahl</label>
        <input
          id="postalCode"
          v-model="formData.postalCode"
          type="text"
          placeholder="z.B. 80331"
          class="form-input"
          maxlength="5"
        />
      </div>
      
      <div class="form-group">
        <label for="city">Stadt</label>
        <input
          id="city"
          v-model="formData.city"
          type="text"
          placeholder="z.B. Berlin"
          class="form-input"
        />
      </div>
      
      <div v-if="coordinates" class="coordinates-display">
        <p class="coordinates-label">Koordinaten:</p>
        <p class="coordinates-value">
          {{ coordinates.lat.toFixed(6) }}, {{ coordinates.lng.toFixed(6) }}
        </p>
      </div>
      
      <div class="form-actions">
        <button 
          class="btn btn-secondary" 
          @click="geocodeAddress"
          :disabled="geocoding || !isFormValid"
          aria-label="Adresse in Koordinaten umwandeln"
        >
          {{ geocoding ? 'Suche...' : 'Adresse suchen' }}
        </button>
        <button 
          class="btn btn-primary" 
          @click="confirmLocation"
          :disabled="!coordinates"
          aria-label="Standort bestätigen"
        >
          Standort verwenden
        </button>
        <button 
          class="btn btn-text" 
          @click="cancel"
          aria-label="Abbrechen"
        >
          Abbrechen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { logInfo, logError } from '../services/logService'

const emit = defineEmits(['confirm', 'cancel'])

const formData = ref({
  street: '',
  postalCode: '',
  city: ''
})

const coordinates = ref(null)
const geocoding = ref(false)

const isFormValid = computed(() => {
  return formData.value.street.trim() !== '' && 
         formData.value.postalCode.trim() !== '' && 
         formData.value.city.trim() !== ''
})

async function geocodeAddress() {
  if (!isFormValid.value) return
  
  geocoding.value = true
  
  try {
    // Verwende Nominatim (OpenStreetMap) für Geocoding
    const address = `${formData.value.street}, ${formData.value.postalCode} ${formData.value.city}, Deutschland`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TankCopilot/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error('Geocoding fehlgeschlagen')
    }
    
    const data = await response.json()
    
    if (data && data.length > 0) {
      const result = data[0]
      coordinates.value = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      }
      logInfo('Adresse geocodiert', { address, coordinates: coordinates.value })
    } else {
      throw new Error('Adresse nicht gefunden')
    }
  } catch (error) {
    logError('Fehler beim Geocoding', { error: error.message, address: formData.value })
    alert('Fehler beim Suchen der Adresse. Bitte überprüfen Sie die Eingabe.')
  } finally {
    geocoding.value = false
  }
}

function confirmLocation() {
  if (coordinates.value) {
    emit('confirm', {
      lat: coordinates.value.lat,
      lng: coordinates.value.lng,
      source: 'manual',
      address: `${formData.value.street}, ${formData.value.postalCode} ${formData.value.city}`
    })
  }
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped>
.location-input {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.location-header {
  margin-bottom: var(--spacing);
  text-align: center;
}

.location-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.location-hint {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.location-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-input {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-small);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 1rem;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.coordinates-display {
  padding: var(--spacing-small);
  background: var(--surface-secondary);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
}

.coordinates-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.coordinates-value {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  color: var(--text-primary);
  word-break: break-all;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
  margin-top: var(--spacing);
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 12px;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
}

.btn-text:hover {
  color: var(--text-primary);
}
</style>

