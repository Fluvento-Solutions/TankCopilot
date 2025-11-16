<template>
  <div class="share-view">
    <h2>App teilen</h2>

    <div class="card">
      <h3 class="card-title">Mit Familie/Freunden teilen</h3>
      <p class="card-description">
        Teilen Sie Ihre Tankdaten mit anderen Geräten. Alle Daten werden verschlüsselt
        übertragen und nur zwischen den Geräten synchronisiert - nie auf einem Server.
      </p>

      <div v-if="!session && !isConnecting" class="share-actions">
        <button 
          class="btn btn-primary" 
          @click="createSession"
          :disabled="creating"
        >
          <ShareNetwork :size="20" weight="bold" aria-hidden="true" />
          {{ creating ? 'Erstelle Session...' : 'Session erstellen' }}
        </button>
        <button 
          class="btn btn-secondary" 
          @click="startScanning"
          :disabled="scanning"
        >
          <QrCode :size="20" weight="bold" aria-hidden="true" />
          {{ scanning ? 'Scanne...' : 'QR-Code scannen' }}
        </button>
      </div>

      <div v-if="session" class="session-active">
        <h4 class="section-title">Session aktiv</h4>
        <p class="session-id">Session-ID: {{ session.sessionId }}</p>
        
        <div class="qr-code-container">
          <h4 class="section-title">QR-Code zum Teilen</h4>
          <div ref="qrCodeContainer" class="qr-code-display"></div>
        </div>

        <div class="share-link-container">
          <h4 class="section-title">Link zum Teilen</h4>
          <div class="share-link-input">
            <input 
              type="text" 
              :value="session.shareLink" 
              readonly 
              class="form-input"
              ref="shareLinkInput"
            />
            <button 
              class="btn btn-secondary"
              @click="copyLink"
              :aria-label="'Link kopieren'"
            >
              <Copy :size="18" weight="bold" aria-hidden="true" />
              {{ linkCopied ? 'Kopiert!' : 'Kopieren' }}
            </button>
          </div>
        </div>

        <div v-if="isSyncConnected" class="sync-status connected">
          <CheckCircle :size="20" weight="bold" aria-hidden="true" />
          <span>Verbunden und synchronisiert</span>
        </div>
        <div v-else class="sync-status waiting">
          <Clock :size="20" weight="bold" aria-hidden="true" />
          <span>Warte auf Verbindung...</span>
        </div>

        <button 
          class="btn btn-danger" 
          @click="disconnect"
        >
          <X :size="20" weight="bold" aria-hidden="true" />
          Verbindung trennen
        </button>
      </div>

      <div v-if="isConnecting && !scanning" class="connecting">
        <h4 class="section-title">Verbinde...</h4>
        <p>Bitte warten Sie, während die Verbindung hergestellt wird.</p>
      </div>

      <div v-if="scanning" class="qr-scanner-container">
        <h4 class="section-title">QR-Code scannen</h4>
        <p class="scanner-hint">Richten Sie die Kamera auf den QR-Code</p>
        <div class="scanner-wrapper">
          <video ref="videoElement" class="scanner-video" autoplay playsinline></video>
          <canvas ref="canvasElement" class="scanner-canvas" style="display: none;"></canvas>
          <div class="scanner-overlay">
            <div class="scanner-frame"></div>
          </div>
        </div>
        <button class="btn btn-danger" @click="stopScanning">
          <X :size="20" weight="bold" aria-hidden="true" />
          Abbrechen
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Wie funktioniert es?</h3>
      <ol class="instructions-list">
        <li>Erstellen Sie eine Session auf diesem Gerät</li>
        <li>Teilen Sie den QR-Code oder Link mit dem anderen Gerät</li>
        <li>Das andere Gerät scannt den QR-Code oder öffnet den Link</li>
        <li>Die Geräte verbinden sich direkt (P2P) und synchronisieren Daten</li>
        <li>Alle Daten werden verschlüsselt übertragen</li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { 
  PhShareNetwork as ShareNetwork, 
  PhQrCode as QrCode,
  PhCopy as Copy,
  PhCheckCircle as CheckCircle,
  PhClock as Clock,
  PhX as X
} from '@phosphor-icons/vue'
import { 
  createSyncSession, 
  joinSyncSession, 
  scanQRCode, 
  disconnectSync, 
  isSyncConnected 
} from '../services/syncService'

const session = ref(null)
const creating = ref(false)
const scanning = ref(false)
const isConnecting = ref(false)
const error = ref('')
const linkCopied = ref(false)
const qrCodeContainer = ref(null)
const shareLinkInput = ref(null)
const syncConnected = ref(false)
const videoElement = ref(null)
const canvasElement = ref(null)

async function createSession() {
  creating.value = true
  error.value = ''
  
  try {
    const newSession = await createSyncSession()
    session.value = newSession
    
    // QR-Code anzeigen
    if (qrCodeContainer.value && newSession.qrCode) {
      qrCodeContainer.value.innerHTML = ''
      qrCodeContainer.value.appendChild(newSession.qrCode)
    }
    
    // Event-Listener für Sync-Status
    window.addEventListener('syncDataReceived', handleSyncData)
    setupDataChangeListener()
    checkSyncStatus()
  } catch (err) {
    console.error('Fehler beim Erstellen der Session:', err)
    error.value = 'Fehler beim Erstellen der Session: ' + err.message
  } finally {
    creating.value = false
  }
}

async function startScanning() {
  scanning.value = true
  error.value = ''
  isConnecting.value = true
  
  try {
    if (!videoElement.value || !canvasElement.value) {
      throw new Error('Video- oder Canvas-Element nicht verfügbar')
    }
    
    const sessionDataString = await scanQRCode(videoElement.value, canvasElement.value)
    if (sessionDataString) {
      await joinSyncSession(sessionDataString)
      session.value = { sessionId: 'connected' }
      window.addEventListener('syncDataReceived', handleSyncData)
      setupDataChangeListener()
      checkSyncStatus()
    } else {
      error.value = 'QR-Code konnte nicht gescannt werden'
    }
  } catch (err) {
    console.error('Fehler beim Scannen:', err)
    error.value = 'Fehler beim Scannen: ' + err.message
  } finally {
    scanning.value = false
    isConnecting.value = false
  }
}

function stopScanning() {
  scanning.value = false
  isConnecting.value = false
  if (videoElement.value && videoElement.value.srcObject) {
    const stream = videoElement.value.srcObject
    stream.getTracks().forEach(track => track.stop())
    videoElement.value.srcObject = null
  }
}

function checkSyncStatus() {
  const interval = setInterval(() => {
    syncConnected.value = isSyncConnected()
    if (syncConnected.value) {
      clearInterval(interval)
    }
  }, 1000)
  
  // Nach 30 Sekunden stoppen
  setTimeout(() => clearInterval(interval), 30000)
}

async function handleSyncData(event) {
  console.log('Sync-Daten empfangen:', event.detail)
  try {
    // Importiere synchronisierte Daten
    if (event.detail && event.detail.data) {
      await importSyncData(event.detail.data)
      console.log('Daten erfolgreich synchronisiert')
    }
  } catch (err) {
    console.error('Fehler beim Importieren der Sync-Daten:', err)
    error.value = 'Fehler beim Synchronisieren: ' + err.message
  }
}

let dataChangeListener = null

// Event-Listener für Datenänderungen (sendet Änderungen an verbundenes Gerät)
function setupDataChangeListener() {
  if (dataChangeListener) {
    window.removeEventListener('dataChanged', dataChangeListener)
  }
  
  dataChangeListener = async (event) => {
    if (isSyncConnected() && session.value) {
      try {
        // Exportiere alle Daten und sende sie
        const allData = await exportAllData()
        await syncData(allData)
      } catch (err) {
        console.error('Fehler beim Senden der Sync-Daten:', err)
      }
    }
  }
  
  window.addEventListener('dataChanged', dataChangeListener)
}

function copyLink() {
  if (shareLinkInput.value) {
    shareLinkInput.value.select()
    document.execCommand('copy')
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  }
}

function disconnect() {
  disconnectSync()
  session.value = null
  syncConnected.value = false
  window.removeEventListener('syncDataReceived', handleSyncData)
  if (qrCodeContainer.value) {
    qrCodeContainer.value.innerHTML = ''
  }
}

// Prüfe URL-Parameter für Sync-Link
onMounted(() => {
  const hash = window.location.hash
  if (hash.includes('#sync?data=')) {
    const dataMatch = hash.match(/data=([^&]+)/)
    if (dataMatch) {
      try {
        const sessionDataString = atob(decodeURIComponent(dataMatch[1]))
        joinSyncSession(sessionDataString)
        session.value = { sessionId: 'connected' }
        isConnecting.value = true
        window.addEventListener('syncDataReceived', handleSyncData)
        checkSyncStatus()
      } catch (err) {
        error.value = 'Fehler beim Verbinden: ' + err.message
      }
    }
  }
})

onUnmounted(() => {
  disconnect()
  window.removeEventListener('syncDataReceived', handleSyncData)
  if (dataChangeListener) {
    window.removeEventListener('dataChanged', dataChangeListener)
  }
})
</script>

<style scoped>
.share-view {
  width: 100%;
}

.card-description {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: var(--spacing);
}

.share-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
}

.session-active {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.session-id {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--text-secondary);
  padding: 8px;
  background: var(--surface-secondary);
  border-radius: var(--radius-small);
}

.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-small);
  padding: var(--spacing);
  background: var(--surface-secondary);
  border-radius: var(--radius);
}

.qr-code-display {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 256px;
  min-width: 256px;
  background: white;
  border-radius: var(--radius-small);
  border: 2px solid var(--border);
}

.share-link-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
}

.share-link-input {
  display: flex;
  gap: var(--spacing-small);
}

.share-link-input .form-input {
  flex: 1;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-small);
  font-weight: 500;
}

.sync-status.connected {
  background: rgba(0, 200, 0, 0.1);
  color: #00a000;
  border: 1px solid rgba(0, 200, 0, 0.3);
}

.sync-status.waiting {
  background: rgba(255, 200, 0, 0.1);
  color: #cc9900;
  border: 1px solid rgba(255, 200, 0, 0.3);
}

.connecting {
  text-align: center;
  padding: var(--spacing);
}

.error-message {
  margin-top: var(--spacing);
  padding: 12px;
  background: rgba(255, 59, 48, 0.1);
  color: #c62828;
  border-radius: var(--radius-small);
  border: 1px solid rgba(255, 59, 48, 0.3);
}

.instructions-list {
  padding-left: 20px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.instructions-list li {
  margin-bottom: 8px;
}

.qr-scanner-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
  align-items: center;
}

.scanner-hint {
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--spacing-small);
}

.scanner-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 1;
  border-radius: var(--radius);
  overflow: hidden;
  background: #000;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-canvas {
  display: none;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scanner-frame {
  width: 70%;
  height: 70%;
  border: 3px solid var(--primary-color);
  border-radius: var(--radius-small);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
}
</style>

