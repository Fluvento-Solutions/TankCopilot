<template>
  <nav class="bottom-nav" role="navigation" aria-label="Hauptnavigation">
    <router-link
      v-for="item in navItems"
      :key="item.route"
      :to="item.route"
      class="nav-item"
      :class="{ active: $route.name === item.routeName }"
      :aria-label="item.label"
      :aria-current="$route.name === item.routeName ? 'page' : undefined"
    >
      <component 
        :is="item.icon" 
        :size="24" 
        :weight="$route.name === item.routeName ? 'fill' : 'regular'" 
        class="nav-icon" 
        :color="$route.name === item.routeName ? 'var(--primary-color)' : 'var(--text-secondary)'"
        aria-hidden="true"
      />
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { PhChartBarHorizontal as ChartBar, PhCar as Car, PhGasPump as GasPump, PhMapPin as MapPin, PhNavigationArrow as Navigation } from '@phosphor-icons/vue'

const navItems = [
  {
    route: '/',
    routeName: 'dashboard',
    icon: ChartBar,
    label: 'Dashboard'
  },
  {
    route: '/vehicles',
    routeName: 'vehicles',
    icon: Car,
    label: 'Fahrzeuge'
  },
  {
    route: '/refuel-log',
    routeName: 'refuel-log',
    icon: GasPump,
    label: 'Tankbuch'
  },
  {
    route: '/trips',
    routeName: 'trips',
    icon: Navigation,
    label: 'Fahrten'
  },
  {
    route: '/plan-refuel',
    routeName: 'plan-refuel',
    icon: MapPin,
    label: 'Tankstellen'
  }
]
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100vw;
  background: #FFFFFF;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-around;
  padding: 12px 0 calc(12px + env(safe-area-inset-bottom));
  z-index: 1000;
  box-shadow: 0 -4px 24px rgba(0, 168, 168, 0.1), 0 -2px 8px rgba(0, 0, 0, 0.05);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: color 0.2s;
  flex: 1;
  max-width: 120px;
  min-height: 44px;
  min-width: 44px;
  justify-content: center;
}

.nav-item:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: -2px;
  border-radius: var(--radius-small);
}

.nav-item.active {
  color: var(--primary-color);
}

.nav-item.active .nav-icon {
  transform: scale(1.15);
  filter: drop-shadow(0 2px 4px var(--primary-glow));
}

.nav-icon {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-label {
  font-size: 0.75rem;
  font-weight: 500;
}

</style>

