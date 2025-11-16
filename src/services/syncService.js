/**
 * Sync Service - P2P-Synchronisation über WebRTC und QR-Code
 * 
 * Ermöglicht gemeinsame Nutzung der App ohne Server-Speicherung.
 * Daten werden verschlüsselt zwischen Geräten übertragen.
 */

// STUN-Server für NAT-Traversal (kostenlos, öffentlich verfügbar)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' }
]

// Connection State Events
const CONNECTION_EVENTS = {
  CONNECTING: 'sync:connecting',
  CONNECTED: 'sync:connected',
  DISCONNECTED: 'sync:disconnected',
  FAILED: 'sync:failed',
  ICE_CONNECTION_STATE_CHANGE: 'sync:ice-state-change'
}

let peerConnection = null
let dataChannel = null
let encryptionKey = null
let isHost = false
let sessionId = null
let iceCandidatesQueue = [] // Queue für ICE-Candidates vor DataChannel-Öffnung
let answerReceived = false // Flag für Answer vom Client
let connectionState = 'disconnected' // 'disconnected', 'connecting', 'connected', 'failed'
let retryCount = 0
let maxRetries = 3
let currentStunIndex = 0

import QRCode from 'qrcode'
import jsQR from 'jsqr'

/**
 * Generiert einen QR-Code als Canvas
 * @param {string} text - Text der im QR-Code kodiert werden soll
 * @param {number} size - Größe des QR-Codes in Pixeln
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function generateQRCode(text, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  
  try {
    await QRCode.toCanvas(canvas, text, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
    return canvas
  } catch (error) {
    console.error('Fehler bei QR-Code-Generierung:', error)
    throw error
  }
}

/**
 * Erstellt eine Session für P2P-Synchronisation
 * @returns {Promise<{sessionId: string, qrCode: HTMLCanvasElement, shareLink: string}>}
 */
export async function createSyncSession() {
  try {
    // Session-ID generieren
    sessionId = generateSessionId()
    isHost = true
    
    // Verschlüsselungsschlüssel generieren
    encryptionKey = await generateEncryptionKey()
    
    // WebRTC PeerConnection erstellen
    peerConnection = new RTCPeerConnection({ iceServers: STUN_SERVERS })
    
    // DataChannel erstellen
    dataChannel = peerConnection.createDataChannel('sync', {
      ordered: true
    })
    
    setupDataChannelHandlers()
    
    // ICE Candidate Handler (Host)
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logDebug('Host ICE Candidate', { candidate: event.candidate })
        // ICE Candidate in Queue speichern oder direkt senden wenn DataChannel offen
        if (dataChannel && dataChannel.readyState === 'open') {
          sendICECandidate(event.candidate)
        } else {
          iceCandidatesQueue.push(event.candidate)
        }
      } else {
        // Alle ICE-Candidates gesammelt
        logInfo('Host: Alle ICE-Candidates gesammelt')
      }
    }
    
    // Connection State Handler
    peerConnection.onconnectionstatechange = () => {
      console.log('Host Connection State:', peerConnection.connectionState)
      if (peerConnection.connectionState === 'failed') {
        console.error('WebRTC-Verbindung fehlgeschlagen')
      }
    }
    
    // Offer erstellen
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    
    // Session-Daten für QR-Code/Link
    const sessionData = {
      sessionId,
      offer: offer.sdp,
      encryptionKey: await exportKey(encryptionKey)
    }
    
    const sessionDataString = JSON.stringify(sessionData)
    const qrCode = await generateQRCode(sessionDataString)
    const shareLink = `${window.location.origin}${window.location.pathname}#sync?data=${encodeURIComponent(btoa(sessionDataString))}`
    
    return {
      sessionId,
      qrCode,
      shareLink
    }
  } catch (error) {
    logError('Fehler beim Erstellen der Sync-Session', { error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Verbindet zu einer bestehenden Session (Client)
 * @param {string} sessionDataString - Session-Daten als String (aus QR-Code/Link)
 * @returns {Promise<void>}
 */
export async function joinSyncSession(sessionDataString) {
  try {
    const sessionData = JSON.parse(sessionDataString)
    sessionId = sessionData.sessionId
    isHost = false
    
    // Verschlüsselungsschlüssel importieren
    encryptionKey = await importKey(sessionData.encryptionKey)
    
    // WebRTC PeerConnection erstellen
    peerConnection = new RTCPeerConnection({ iceServers: STUN_SERVERS })
    
    // DataChannel Handler (wird vom Host erstellt)
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel
      setupDataChannelHandlers()
    }
    
    // ICE Candidate Handler (Client)
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logDebug('Client ICE Candidate', { candidate: event.candidate })
        // ICE Candidate in Queue speichern oder direkt senden wenn DataChannel offen
        if (dataChannel && dataChannel.readyState === 'open') {
          sendICECandidate(event.candidate)
        } else {
          iceCandidatesQueue.push(event.candidate)
        }
      } else {
        // Alle ICE-Candidates gesammelt
        logInfo('Client: Alle ICE-Candidates gesammelt')
      }
    }
    
    // Connection State Handler
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      connectionState = state
      logInfo('Client Connection State', { state })
      
      window.dispatchEvent(new CustomEvent(CONNECTION_EVENTS.ICE_CONNECTION_STATE_CHANGE, {
        detail: { state, isHost: false }
      }))
      
      if (state === 'connected') {
        window.dispatchEvent(new CustomEvent(CONNECTION_EVENTS.CONNECTED, {
          detail: { isHost: false }
        }))
        retryCount = 0
      } else if (state === 'failed' || state === 'disconnected') {
        handleConnectionFailure('client')
      }
    }
    
    // ICE Connection State Handler
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState
      console.log('Client ICE Connection State:', iceState)
      
      window.dispatchEvent(new CustomEvent(CONNECTION_EVENTS.ICE_CONNECTION_STATE_CHANGE, {
        detail: { state: iceState, isHost: false }
      }))
      
      if (iceState === 'failed') {
        handleConnectionFailure('client')
      }
    }
    
    // Answer erstellen
    await peerConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: sessionData.offer
    }))
    
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    
    // Answer wird über DataChannel gesendet, sobald dieser offen ist
    answerReceived = false
    logInfo('Client: Answer erstellt, warte auf DataChannel...')
  } catch (error) {
    logError('Fehler beim Verbinden zur Sync-Session', { error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Scant einen QR-Code von der Kamera
 * @param {HTMLVideoElement} videoElement - Video-Element für Kamera-Stream
 * @param {HTMLCanvasElement} canvasElement - Canvas-Element für Frame-Rendering
 * @returns {Promise<string>} - Session-Daten als String
 */
export async function scanQRCode(videoElement, canvasElement) {
  try {
    // Kamera-Zugriff anfordern
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    })
    
    videoElement.srcObject = stream
    videoElement.setAttribute('playsinline', 'true')
    
    await videoElement.play()
    
    const canvas = canvasElement || document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    return new Promise((resolve, reject) => {
      const scanInterval = setInterval(() => {
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvas.width = videoElement.videoWidth
          canvas.height = videoElement.videoHeight
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          
          if (code) {
            clearInterval(scanInterval)
            stream.getTracks().forEach(track => track.stop())
            videoElement.srcObject = null
            resolve(code.data)
          }
        }
      }, 100) // Scanne alle 100ms
      
      // Timeout nach 60 Sekunden
      setTimeout(() => {
        clearInterval(scanInterval)
        stream.getTracks().forEach(track => track.stop())
        videoElement.srcObject = null
        reject(new Error('QR-Code-Scan-Timeout: Kein QR-Code erkannt'))
      }, 60000)
    })
  } catch (error) {
    logError('Fehler beim Scannen des QR-Codes', { error: error.message })
    throw new Error('Kamera-Zugriff verweigert oder nicht verfügbar: ' + error.message)
  }
}

/**
 * Synchronisiert Daten mit verbundenem Gerät
 * @param {Object} data - Daten die synchronisiert werden sollen
 * @returns {Promise<void>}
 */
export async function syncData(data) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    throw new Error('DataChannel nicht verbunden')
  }
  
  try {
    // Daten verschlüsseln
    const encryptedData = await encryptData(JSON.stringify(data), encryptionKey)
    
    // Daten senden
    dataChannel.send(JSON.stringify({
      type: 'sync',
      data: encryptedData,
      timestamp: Date.now()
    }))
  } catch (error) {
    logError('Fehler beim Synchronisieren der Daten', { error: error.message })
    throw error
  }
}

/**
 * Trennt die Sync-Verbindung
 */
export function disconnectSync() {
  if (dataChannel) {
    dataChannel.close()
    dataChannel = null
  }
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  sessionId = null
  isHost = false
  encryptionKey = null
  iceCandidatesQueue = []
  answerReceived = false
  connectionState = 'disconnected'
  retryCount = 0
  currentStunIndex = 0
  
  window.dispatchEvent(new CustomEvent(CONNECTION_EVENTS.DISCONNECTED))
}

/**
 * Prüft ob eine Sync-Verbindung aktiv ist
 * @returns {boolean}
 */
export function isSyncConnected() {
  return dataChannel && dataChannel.readyState === 'open'
}

// ==================== HELPER FUNCTIONS ====================

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

async function generateEncryptionKey() {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
}

async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key)
  return Array.from(new Uint8Array(exported))
}

async function importKey(keyData) {
  return await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyData),
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
}

async function encryptData(data, key) {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBuffer
  )
  
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }
}

async function decryptData(encryptedData, key) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(encryptedData.iv)
    },
    key,
    new Uint8Array(encryptedData.data)
  )
  
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

function setupDataChannelHandlers() {
  if (!dataChannel) return
  
  dataChannel.onopen = () => {
    logInfo('DataChannel geöffnet', { isHost })
    
    // Sende alle gesammelten ICE-Candidates
    while (iceCandidatesQueue.length > 0) {
      const candidate = iceCandidatesQueue.shift()
      sendICECandidate(candidate)
    }
    
    // Client: Sende Answer an Host
    if (!isHost && peerConnection.localDescription && !answerReceived) {
      sendAnswer(peerConnection.localDescription)
      answerReceived = true
    }
  }
  
  dataChannel.onclose = () => {
    logWarn('DataChannel geschlossen', { isHost })
  }
  
  dataChannel.onerror = (error) => {
    logError('DataChannel Fehler', { error: error.message || error, isHost })
  }
  
  dataChannel.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data)
      
      if (message.type === 'ice-candidate') {
        // ICE Candidate empfangen
        await handleICECandidate(message.candidate)
      } else if (message.type === 'answer') {
        // Answer vom Client empfangen (Host)
        if (isHost && !answerReceived) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: message.sdp
          }))
          answerReceived = true
          logInfo('Host: Answer vom Client empfangen')
        }
      } else if (message.type === 'sync') {
        // Daten entschlüsseln
        try {
          const decryptedData = await decryptData(message.data, encryptionKey)
          const data = JSON.parse(decryptedData)
          
          // Event für Storage-Service auslösen
          window.dispatchEvent(new CustomEvent('syncDataReceived', {
            detail: { data, timestamp: message.timestamp }
          }))
        } catch (decryptError) {
          logError('Fehler beim Entschlüsseln der Sync-Daten', { error: decryptError.message })
          // Event für Fehler auslösen
          window.dispatchEvent(new CustomEvent('syncDataError', {
            detail: { error: decryptError.message }
          }))
        }
      } else if (message.type === 'error') {
        // Fehlermeldung vom anderen Gerät
        logError('Fehler vom anderen Gerät', { error: message.error })
        window.dispatchEvent(new CustomEvent('syncDataError', {
          detail: { error: message.error }
        }))
      }
    } catch (error) {
      logError('Fehler beim Verarbeiten der Sync-Nachricht', { error: error.message })
      // Sende Fehler an anderes Gerät
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(JSON.stringify({
            type: 'error',
            error: error.message
          }))
        } catch (sendError) {
          logError('Fehler beim Senden der Fehlermeldung', { error: sendError.message })
        }
      }
    }
  }
}

/**
 * Sendet einen ICE-Candidate über den DataChannel
 * @param {RTCIceCandidate} candidate - ICE-Candidate
 */
function sendICECandidate(candidate) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({
      type: 'ice-candidate',
      candidate: candidate.toJSON()
    }))
  }
}

/**
 * Sendet Answer über den DataChannel (Client -> Host)
 * @param {RTCSessionDescription} answer - Answer SDP
 */
function sendAnswer(answer) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({
      type: 'answer',
      sdp: answer.sdp
    }))
    logInfo('Client: Answer an Host gesendet')
  }
}

/**
 * Verarbeitet einen empfangenen ICE-Candidate
 * @param {Object} candidateData - ICE-Candidate Daten
 */
async function handleICECandidate(candidateData) {
  try {
    const candidate = new RTCIceCandidate(candidateData)
    await peerConnection.addIceCandidate(candidate)
    logDebug('ICE-Candidate hinzugefügt', { candidate })
  } catch (error) {
    logError('Fehler beim Hinzufügen des ICE-Candidates', { error: error.message })
  }
}

