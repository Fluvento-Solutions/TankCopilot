<template>
  <div class="settings-view">
    <h2>Einstellungen</h2>

    <div class="card">
      <h3 class="card-title">Berechtigungen</h3>
      
      <!-- Standortberechtigung -->
      <div class="permission-item">
        <div class="permission-header">
          <div class="permission-info">
            <h4 class="permission-name">📍 Standort</h4>
            <p class="permission-description">
              Wird benötigt, um Tankstellen in Ihrer Nähe zu finden
            </p>
          </div>
          <div class="permission-status" :class="`status-${locationPermissionStatus}`">
            {{ getPermissionStatusText(locationPermissionStatus) }}
          </div>
        </div>
        <div class="permission-actions">
          <button 
            class="btn btn-secondary btn-small"
            @click="checkLocationPermissionStatus"
            :disabled="checkingLocation"
          >
            {{ checkingLocation ? 'Prüfe...' : 'Status prüfen' }}
          </button>
          <button 
            v-if="locationPermissionStatus === 'prompt' || locationPermissionStatus === 'denied'"
            class="btn btn-primary btn-small"
            @click="requestLocationPermissionAction"
            :disabled="requestingLocation"
          >
            {{ requestingLocation ? 'Anfrage...' : 'Berechtigung anfordern' }}
          </button>
          <button 
            v-if="locationPermissionStatus === 'denied'"
            class="btn btn-secondary btn-small"
            @click="openLocationSettings"
          >
            Einstellungen öffnen
          </button>
        </div>
      </div>

      <!-- Benachrichtigungsberechtigung -->
      <div class="permission-item">
        <div class="permission-header">
          <div class="permission-info">
            <h4 class="permission-name">🔔 Benachrichtigungen</h4>
            <p class="permission-description">
              Für zukünftige Features (z.B. Preisalarme)
            </p>
          </div>
          <div class="permission-status" :class="`status-${notificationPermissionStatus}`">
            {{ getPermissionStatusText(notificationPermissionStatus) }}
          </div>
        </div>
        <div class="permission-actions">
          <button 
            class="btn btn-secondary btn-small"
            @click="checkNotificationPermissionStatus"
            :disabled="checkingNotification"
          >
            {{ checkingNotification ? 'Prüfe...' : 'Status prüfen' }}
          </button>
          <button 
            v-if="notificationPermissionStatus === 'default' || notificationPermissionStatus === 'prompt'"
            class="btn btn-primary btn-small"
            @click="requestNotificationPermissionAction"
            :disabled="requestingNotification"
          >
            {{ requestingNotification ? 'Anfrage...' : 'Berechtigung anfordern' }}
          </button>
          <button 
            v-if="notificationPermissionStatus === 'denied'"
            class="btn btn-secondary btn-small"
            @click="openNotificationSettings"
          >
            Einstellungen öffnen
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">App-Einstellungen</h3>
      
      <div class="form-group">
        <div class="form-checkbox">
          <input
            v-model="settings.allowGeolocation"
            type="checkbox"
            id="allowGeolocation"
            @change="saveSettings"
          />
          <label for="allowGeolocation">Geolocation erlauben</label>
        </div>
        <small class="form-hint">
          Standort wird nur bei expliziter Tankstellensuche verwendet
        </small>
      </div>

      <div class="form-group">
        <label class="form-label">Währung</label>
        <select v-model="settings.currency" class="form-select" @change="saveSettings">
          <option value="EUR">EUR (€)</option>
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Distanz-Einheit</label>
        <select v-model="settings.distanceUnit" class="form-select" @change="saveSettings">
          <option value="km">Kilometer (km)</option>
          <option value="mi">Meilen (mi)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Bevorzugte Navigations-App</label>
        <select v-model="settings.preferredNavigationApp" class="form-select" @change="saveSettings">
          <option value="auto">Automatisch (Plattform-Erkennung)</option>
          <option value="apple">Apple Maps</option>
          <option value="google">Google Maps</option>
          <option value="waze">Waze</option>
          <option value="osmand">OsmAnd</option>
        </select>
        <small class="form-hint">
          Wird für die Navigation zu Tankstellen verwendet
        </small>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">App teilen</h3>
      <div class="share-section">
        <p class="share-description">
          Teilen Sie Ihre Tankdaten mit anderen Geräten. Alle Daten werden verschlüsselt
          übertragen und nur zwischen den Geräten synchronisiert.
        </p>
        <router-link to="/share" class="btn btn-primary">
          <ShareNetwork :size="20" weight="bold" aria-hidden="true" />
          App teilen öffnen
        </router-link>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Über TankCopilot</h3>
      <div class="about-content">
        <p><strong>App-Name:</strong> TankCopilot</p>
        <p><strong>Version:</strong> 1.0.0</p>
        <p class="about-description">
          TankCopilot ist eine mobile PWA für Autofahrer, die ein digitales Tankbuch führt
          und bei der optimalen Tankstellenwahl hilft.
        </p>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Datenverwaltung</h3>
      <div class="data-management">
        <div class="data-export-section">
          <h4 class="section-subtitle">Datenexport (DSGVO Art. 20)</h4>
          <p class="data-info">
            Sie haben das Recht, Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten.
          </p>
          <button 
            class="btn btn-secondary" 
            @click="exportData"
            :disabled="exporting"
            aria-label="Alle Daten als JSON exportieren"
          >
            <Download :size="20" weight="bold" aria-hidden="true" />
            {{ exporting ? 'Exportiere...' : 'Daten exportieren (JSON)' }}
          </button>
          <small class="form-hint">
            Exportiert alle Fahrzeuge, Tankvorgänge und Einstellungen als JSON-Datei
          </small>
        </div>

        <div class="data-delete-section">
          <h4 class="section-subtitle">Daten löschen (DSGVO Art. 17)</h4>
          <p class="data-warning">
            <strong>⚠️ Achtung:</strong> Das Löschen aller lokalen Daten kann nicht rückgängig gemacht werden!
          </p>
          <button 
            class="btn btn-danger" 
            @click="confirmDeleteAllData"
            :disabled="deleting"
            aria-label="Alle lokalen Daten löschen"
          >
            <Trash :size="20" weight="bold" aria-hidden="true" />
            {{ deleting ? 'Lösche...' : 'Alle lokalen Daten löschen' }}
          </button>
          <small class="form-hint">
            Löscht alle Fahrzeuge, Tankvorgänge und Einstellungen
          </small>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Datenschutz & Rechtliches</h3>
      <div class="privacy-content">
        <div class="privacy-section">
          <h4 class="section-subtitle">Datenschutzerklärung</h4>
          <p><strong>Verantwortlicher:</strong></p>
          <p>
            Bitte ergänzen Sie hier Ihre Kontaktdaten als Verantwortlicher gemäß DSGVO Art. 13.
            (Name, Adresse, E-Mail, ggf. Datenschutzbeauftragter)
          </p>
          
          <p><strong>Lokale Datenspeicherung:</strong></p>
          <p>
            Alle Ihre Fahrzeug- und Tankdaten werden ausschließlich lokal in Ihrem Browser
            gespeichert (IndexedDB). Keine Daten werden an Server übertragen oder gespeichert.
            Die Daten verbleiben auf Ihrem Gerät und werden nicht mit Dritten geteilt.
          </p>
          
          <p><strong>Standortdaten:</strong></p>
          <p>
            Ihr Standort wird nur zum Zeitpunkt einer expliziten Tankstellensuche verwendet
            (Geolocation API). Die Standortdaten werden nicht serverseitig gespeichert oder
            dauerhaft verfolgt. Sie können die Geolocation-Funktion jederzeit in den Einstellungen
            deaktivieren.
          </p>
          
          <p><strong>Service Worker & Cookies:</strong></p>
          <p>
            Die App verwendet einen Service Worker für Offline-Funktionalität und Caching.
            Dieser ist technisch notwendig für die PWA-Funktionalität. Es werden keine
            Tracking-Cookies oder Analytics-Cookies verwendet.
          </p>
          
          <p><strong>Keine Tracking-Technologien:</strong></p>
          <p>
            Die App verwendet keine Tracking-Technologien, Analytics-Dienste, Social Media
            Plugins oder Werbe-Cookies.
          </p>
          
          <p><strong>Ihre Rechte (DSGVO):</strong></p>
          <ul class="privacy-list">
            <li><strong>Art. 15:</strong> Recht auf Auskunft über gespeicherte Daten</li>
            <li><strong>Art. 16:</strong> Recht auf Berichtigung unrichtiger Daten</li>
            <li><strong>Art. 17:</strong> Recht auf Löschung (siehe "Daten löschen" oben)</li>
            <li><strong>Art. 18:</strong> Recht auf Einschränkung der Verarbeitung</li>
            <li><strong>Art. 20:</strong> Recht auf Datenübertragbarkeit (siehe "Daten exportieren" oben)</li>
            <li><strong>Art. 21:</strong> Widerspruchsrecht</li>
            <li><strong>Art. 77:</strong> Beschwerderecht bei einer Aufsichtsbehörde</li>
          </ul>
        </div>

        <div class="legal-section">
          <h4 class="section-subtitle">Impressum</h4>
          <p>
            <strong>Betreiber:</strong> Bastian Flügel
          </p>
          <p>
            <a 
              href="https://fluvento.de/impressum/" 
              target="_blank" 
              rel="noopener noreferrer"
              class="impressum-link"
            >
              Vollständiges Impressum anzeigen →
            </a>
          </p>
        </div>

        <div class="legal-section">
          <h4 class="section-subtitle">Haftungsausschluss</h4>
          <p>
            Die App wird "wie besehen" bereitgestellt. Für die Richtigkeit der Spritpreise,
            Entfernungen oder Navigation wird keine Haftung übernommen. Die App dient als
            Hilfsmittel und ersetzt nicht die eigenverantwortliche Prüfung der Informationen.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { PhTrash as Trash, PhDownload as Download, PhFileText as FileText, PhInfo as Info, PhShareNetwork as ShareNetwork, PhX as X } from '@phosphor-icons/vue'
import { loadSettings, saveSettings as saveSettingsService, deleteAllData, exportAllData, getDataStats, deleteVehicles, deleteRefuels, deleteSettings, getAllVehicles, getAllRefuels } from '../services/storageService'
import { getLogs, exportLogs as exportLogsService, clearLogs as clearLogsService } from '../services/logService'
import { 
  checkLocationPermission, 
  requestLocationPermission,
  checkNotificationPermission,
  requestNotificationPermission,
  openSystemSettings,
  detectPlatform
} from '../services/permissionService'

const settings = ref({
  allowGeolocation: true,
  currency: 'EUR',
  language: 'de',
  distanceUnit: 'km',
  preferredNavigationApp: 'auto'
})

const deleting = ref(false)
const exporting = ref(false)
const showLogsModal = ref(false)
const logs = ref([])
const exportingLogs = ref(false)
const clearingLogs = ref(false)
const dataStats = ref(null)
const deleteOptions = ref({
  allVehicles: false,
  allRefuels: false,
  allSettings: false
})

// Berechtigungsstatus
const locationPermissionStatus = ref('prompt')
const notificationPermissionStatus = ref('default')
const checkingLocation = ref(false)
const requestingLocation = ref(false)
const checkingNotification = ref(false)
const requestingNotification = ref(false)
const platform = ref(detectPlatform())

async function loadSettingsData() {
  const loadedSettings = await loadSettings()
  settings.value = { ...settings.value, ...loadedSettings }
  await loadDataStats()
  await checkAllPermissions()
}

async function checkAllPermissions() {
  locationPermissionStatus.value = await checkLocationPermission()
  notificationPermissionStatus.value = await checkNotificationPermission()
}

async function checkLocationPermissionStatus() {
  checkingLocation.value = true
  try {
    locationPermissionStatus.value = await checkLocationPermission()
  } catch (error) {
    console.error('Fehler beim Prüfen der Standortberechtigung:', error)
  } finally {
    checkingLocation.value = false
  }
}

async function requestLocationPermissionAction() {
  requestingLocation.value = true
  try {
    const result = await requestLocationPermission()
    if (result === 'granted') {
      locationPermissionStatus.value = 'granted'
    } else if (result === 'denied') {
      locationPermissionStatus.value = 'denied'
    }
  } catch (error) {
    console.error('Fehler beim Anfordern der Standortberechtigung:', error)
  } finally {
    requestingLocation.value = false
  }
}

function openLocationSettings() {
  openSystemSettings('location')
}

async function checkNotificationPermissionStatus() {
  checkingNotification.value = true
  try {
    notificationPermissionStatus.value = await checkNotificationPermission()
  } catch (error) {
    console.error('Fehler beim Prüfen der Benachrichtigungsberechtigung:', error)
  } finally {
    checkingNotification.value = false
  }
}

async function requestNotificationPermissionAction() {
  requestingNotification.value = true
  try {
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      notificationPermissionStatus.value = 'granted'
    } else if (result === 'denied') {
      notificationPermissionStatus.value = 'denied'
    }
  } catch (error) {
    console.error('Fehler beim Anfordern der Benachrichtigungsberechtigung:', error)
  } finally {
    requestingNotification.value = false
  }
}

function openNotificationSettings() {
  openSystemSettings('notification')
}

function getPermissionStatusText(status) {
  const statusMap = {
    'granted': '✅ Erteilt',
    'denied': '❌ Verweigert',
    'prompt': '⏳ Ausstehend',
    'default': '⏳ Ausstehend',
    'unsupported': '❌ Nicht unterstützt'
  }
  return statusMap[status] || '❓ Unbekannt'
}

async function loadDataStats() {
  try {
    dataStats.value = await getDataStats()
  } catch (error) {
    console.error('Fehler beim Laden der Daten-Statistiken:', error)
  }
}

async function saveSettings() {
  try {
    await saveSettingsService(settings.value)
  } catch (error) {
    console.error('Fehler beim Speichern der Einstellungen:', error)
    alert('Fehler beim Speichern der Einstellungen')
  }
}

async function exportData() {
  exporting.value = true
  try {
    const data = await exportAllData()
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tankcopilot-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Fehler beim Exportieren der Daten:', error)
    alert('Fehler beim Exportieren der Daten')
  } finally {
    exporting.value = false
  }
}

async function confirmSelectiveDelete() {
  const items = []
  if (deleteOptions.value.allVehicles) items.push('Fahrzeuge')
  if (deleteOptions.value.allRefuels) items.push('Tankvorgänge')
  if (deleteOptions.value.allSettings) items.push('Einstellungen')
  
  const confirmed = confirm(
    `Möchten Sie wirklich die folgenden Daten löschen?\n\n` +
    `• ${items.join('\n• ')}\n\n` +
    `Diese Aktion kann nicht rückgängig gemacht werden!`
  )
  
  if (!confirmed) return
  
  deleting.value = true
  try {
    if (deleteOptions.value.allVehicles) {
      const vehicles = await getAllVehicles()
      await deleteVehicles(vehicles.map(v => v.id))
    }
    
    if (deleteOptions.value.allRefuels) {
      const refuels = await getAllRefuels()
      await deleteRefuels(refuels.map(r => r.id))
    }
    
    if (deleteOptions.value.allSettings) {
      const currentSettings = await loadSettings()
      await deleteSettings(Object.keys(currentSettings))
    }
    
    // Reset Options
    deleteOptions.value = {
      allVehicles: false,
      allRefuels: false,
      allSettings: false
    }
    
    await loadDataStats()
    alert('Ausgewählte Daten wurden erfolgreich gelöscht.')
  } catch (error) {
    console.error('Fehler beim Löschen der Daten:', error)
    alert('Fehler beim Löschen der Daten: ' + error.message)
  } finally {
    deleting.value = false
  }
}

async function confirmDeleteAllData() {
  const confirmed = confirm(
    'Möchten Sie wirklich ALLE lokalen Daten löschen?\n\n' +
    'Dies umfasst:\n' +
    '• Alle Fahrzeuge\n' +
    '• Alle Tankvorgänge\n' +
    '• Alle Einstellungen\n\n' +
    'Diese Aktion kann nicht rückgängig gemacht werden!'
  )
  
  if (!confirmed) return
  
  deleting.value = true
  try {
    await deleteAllData()
    alert('Alle lokalen Daten wurden erfolgreich gelöscht. Die Seite wird neu geladen.')
    window.location.reload()
  } catch (error) {
    console.error('Fehler beim Löschen der Daten:', error)
    alert('Fehler beim Löschen der Daten')
    deleting.value = false
  }
}

async function viewLogs() {
  showLogsModal.value = true
  try {
    logs.value = await getLogs({ limit: 100 })
  } catch (error) {
    console.error('Fehler beim Laden der Protokolle:', error)
    alert('Fehler beim Laden der Protokolle')
  }
}

function closeLogsModal() {
  showLogsModal.value = false
  logs.value = []
}

function formatLogTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function exportLogs() {
  exportingLogs.value = true
  try {
    const logsJson = await exportLogsService()
    const blob = new Blob([logsJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tankcopilot-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Fehler beim Exportieren der Protokolle:', error)
    alert('Fehler beim Exportieren der Protokolle')
  } finally {
    exportingLogs.value = false
  }
}

async function clearLogs() {
  const confirmed = confirm('Möchten Sie wirklich alle Protokolle löschen?')
  if (!confirmed) return
  
  clearingLogs.value = true
  try {
    await clearLogsService()
    if (showLogsModal.value) {
      logs.value = []
    }
    alert('Protokolle wurden erfolgreich gelöscht')
  } catch (error) {
    console.error('Fehler beim Löschen der Protokolle:', error)
    alert('Fehler beim Löschen der Protokolle')
  } finally {
    clearingLogs.value = false
  }
}

onMounted(() => {
  loadSettingsData()
})
</script>

<style scoped>
.settings-view {
  width: 100%;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--spacing);
  color: var(--text-primary);
}

.about-content,
.privacy-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.about-description {
  margin-top: 8px;
}

.privacy-content p {
  margin: 0 0 8px 0;
}

.privacy-content strong {
  color: var(--text-primary);
  display: block;
  margin-top: 12px;
  margin-bottom: 4px;
}

.privacy-section,
.legal-section {
  margin-bottom: var(--spacing);
  padding-bottom: var(--spacing);
  border-bottom: 1px solid var(--glass-border);
}

.privacy-section:last-child,
.legal-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.privacy-list {
  margin: 8px 0;
  padding-left: 20px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.privacy-list li {
  margin-bottom: 4px;
}

.share-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.share-description {
  color: var(--text-secondary);
  line-height: 1.6;
}

.data-management {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.data-export-section,
.data-delete-section {
  padding: var(--spacing-small);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
}

.section-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.data-info {
  padding: 12px;
  background: rgba(0, 168, 168, 0.1);
  border: 1px solid rgba(0, 168, 168, 0.3);
  border-radius: var(--radius-small);
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 12px;
}

.data-warning {
  padding: 12px;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: var(--radius-small);
  color: #c62828;
  font-size: 0.9rem;
  line-height: 1.5;
}

.data-warning strong {
  color: #c62828;
}

.btn-danger {
  background: linear-gradient(135deg, #ff3b30 0%, #c62828 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 16px rgba(255, 59, 48, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-danger:hover {
  background: linear-gradient(135deg, #c62828 0%, #ff3b30 100%);
  box-shadow: 0 6px 20px rgba(255, 59, 48, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.btn-danger:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.permission-item {
  padding: var(--spacing-small);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-small);
  border: 1px solid var(--glass-border);
  margin-bottom: var(--spacing);
}

.permission-item:last-child {
  margin-bottom: 0;
}

.permission-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-small);
  margin-bottom: var(--spacing-small);
}

.permission-info {
  flex: 1;
}

.permission-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.permission-description {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0;
}

.permission-status {
  font-size: 0.9rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-granted {
  background: rgba(0, 200, 83, 0.15);
  color: #00c853;
  border: 1px solid rgba(0, 200, 83, 0.3);
}

.status-denied {
  background: rgba(255, 59, 48, 0.15);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.3);
}

.status-prompt,
.status-default {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.status-unsupported {
  background: rgba(128, 128, 128, 0.15);
  color: #808080;
  border: 1px solid rgba(128, 128, 128, 0.3);
}

.permission-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-small {
  padding: 8px 16px;
  font-size: 0.9rem;
  min-height: 36px;
}

.impressum-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.impressum-link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

.impressum-link:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>

