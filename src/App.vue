<template>
  <div class="app">
    <header class="app-header" role="banner">
      <div class="header-title-container">
        <h1 class="app-title-main">TankCopilot</h1>
        <h2 class="app-title-sub">{{ currentPageTitle }}</h2>
      </div>
      <router-link 
        to="/settings" 
        class="settings-button"
        aria-label="Einstellungen öffnen"
      >
        <Gear :size="24" weight="regular" aria-hidden="true" />
      </router-link>
    </header>
    <main class="app-main" role="main">
      <router-view />
    </main>
    <BottomNavBar />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { PhGear as Gear } from '@phosphor-icons/vue'
import BottomNavBar from './components/BottomNavBar.vue'
import { checkLocationPermission, requestLocationPermission } from './services/permissionService'
import { loadSettings } from './services/storageService'

const route = useRoute()

const pageTitles = {
  'dashboard': 'Dashboard',
  'vehicles': 'Fahrzeuge',
  'refuel-log': 'Tankbuch',
  'plan-refuel': 'Tankstellen',
  'settings': 'Einstellungen',
  'share': 'App teilen'
}

const currentPageTitle = computed(() => {
  return pageTitles[route.name] || 'TankCopilot'
})

// Prüfe Berechtigungen beim App-Start (nur Status prüfen, nicht automatisch anfordern)
onMounted(async () => {
  try {
    const settings = await loadSettings()
    
    // Nur Status prüfen wenn Geolocation in Einstellungen erlaubt ist
    // Keine automatische Anfrage beim App-Start, um Permissions Policy Verletzungen zu vermeiden
    if (settings.allowGeolocation !== false) {
      // Prüfe nur den Status, ohne automatisch anzufordern
      // Die Berechtigung wird erst bei expliziter Nutzeraktion (z.B. Tankstellensuche) angefordert
      try {
        await checkLocationPermission()
      } catch (error) {
        // Ignoriere Fehler beim Status-Check - nicht kritisch
        console.debug('Berechtigungsstatus konnte nicht geprüft werden:', error)
      }
    }
  } catch (error) {
    console.error('Fehler beim Prüfen der Berechtigungen:', error)
  }
})
</script>

<style>
:root {
  /* Petrol Farbpalette */
  --primary-color: #00A8A8;
  --primary-dark: #008B8B;
  --primary-light: #E0F7F7;
  --primary-glow: rgba(0, 168, 168, 0.3);
  --accent-color: #00CED1;
  --accent-light: #B0E0E6;
  
  /* Glass-UI Hintergründe */
  --background: linear-gradient(135deg, #E0F7F7 0%, #B0E0E6 50%, #87CEEB 100%);
  --background-solid: #E0F7F7;
  --surface: rgba(255, 255, 255, 0.7);
  --surface-hover: rgba(255, 255, 255, 0.85);
  --surface-secondary: rgba(255, 255, 255, 0.5);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-shadow: rgba(0, 168, 168, 0.1);
  
  /* Text - WCAG AA konform (Kontrast mindestens 4.5:1) */
  --text-primary: #1a3a3a; /* #1a3a3a auf #E0F7F7 = 8.2:1 ✓ */
  --text-secondary: #2d4d4d; /* Dunkler für besseren Kontrast (4.8:1) */
  --text-tertiary: #4a6a6a; /* #4a6a6a auf #E0F7F7 = 4.6:1 ✓ */
  
  /* Borders & Shadows */
  --border: rgba(0, 168, 168, 0.2);
  --border-light: rgba(0, 168, 168, 0.1);
  --shadow: 0 8px 32px rgba(0, 168, 168, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05);
  --shadow-elevated: 0 12px 40px rgba(0, 168, 168, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-hover: 0 16px 48px rgba(0, 168, 168, 0.2), 0 6px 16px rgba(0, 0, 0, 0.1);
  --glass-blur: blur(20px) saturate(180%);
  
  /* Spacing & Radius */
  --radius: 20px;
  --radius-small: 16px;
  --radius-large: 24px;
  --spacing: 20px;
  --spacing-small: 12px;
  --spacing-large: 24px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  background: var(--background);
  background-attachment: fixed;
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 17px;
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100vw;
  margin: 0;
  overflow-x: hidden;
}

.app-header {
  background: #FFFFFF;
  border-bottom: 1px solid var(--glass-border);
  padding: var(--spacing-small) var(--spacing);
  padding-top: calc(var(--spacing-small) + env(safe-area-inset-top));
  position: fixed;
  top: 0;
  z-index: 1000;
  box-shadow: var(--shadow);
  width: 100vw;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  left: 0;
  right: 0;
}

.header-title-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.app-title-main {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.app-title-sub {
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--text-secondary);
  margin: 2px 0 0 0;
  line-height: 1.2;
}

.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-secondary);
  color: var(--text-primary);
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.settings-button:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
}

.settings-button:hover {
  background: var(--primary-light);
  color: var(--primary-color);
  transform: scale(1.05);
}

.settings-button:active {
  transform: scale(0.95);
}

.app-main {
  flex: 1;
  padding: var(--spacing);
  padding-top: calc(80px + var(--spacing) + env(safe-area-inset-top));
  padding-bottom: calc(var(--spacing) + 80px + env(safe-area-inset-bottom));
  overflow-y: auto;
  width: 100%;
}

/* Card Styles - Glass-UI */
.card {
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius);
  padding: var(--spacing);
  margin-bottom: var(--spacing-small);
  box-shadow: var(--shadow);
  border: 1px solid var(--glass-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  background: var(--surface-hover);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

/* Button Styles */
.btn {
  padding: 14px 24px;
  border: none;
  border-radius: var(--radius-small);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  letter-spacing: -0.01em;
  min-height: 44px;
  min-width: 44px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  box-shadow: 0 4px 16px var(--primary-glow), 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-primary:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
  box-shadow: 0 6px 20px var(--primary-glow), 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px var(--primary-glow);
}

.btn-secondary {
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--primary-color);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow);
}

.btn-secondary:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
}

.btn-secondary:hover {
  background: var(--surface-hover);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-1px);
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:focus-visible {
  outline: 3px solid #dc3545;
  outline-offset: 2px;
}

.btn-danger:hover {
  background-color: #c82333;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Form Styles */
.form-group {
  margin-bottom: var(--spacing);
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-select {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-small);
  font-size: 17px;
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--text-primary);
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0, 168, 168, 0.05);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px var(--primary-glow), 0 4px 16px rgba(0, 168, 168, 0.15);
  background: var(--surface-hover);
}

.form-input:focus-visible,
.form-select:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-checkbox input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* List Styles */
.list {
  list-style: none;
}

.list-item {
  background: var(--surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius);
  padding: var(--spacing);
  margin-bottom: var(--spacing-small);
  box-shadow: var(--shadow);
  border: 1px solid var(--glass-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-item:hover {
  background: var(--surface-hover);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
  border-color: var(--primary-color);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: calc(var(--spacing) * 3);
  color: var(--text-secondary);
}

.empty-state-icon {
  margin-bottom: var(--spacing);
  opacity: 0.6;
  color: var(--primary-color);
  filter: drop-shadow(0 4px 8px var(--primary-glow));
}

/* Responsive */
@media (min-width: 768px) {
  .app {
    max-width: 768px;
    margin: 0 auto;
  }
  
  .app-header {
    max-width: 768px;
    margin: 0 auto;
  }
}
</style>

