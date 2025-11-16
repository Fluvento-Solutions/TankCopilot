import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import VehiclesView from '../views/VehiclesView.vue'
import RefuelLogView from '../views/RefuelLogView.vue'
import PlanRefuelView from '../views/PlanRefuelView.vue'
import SettingsView from '../views/SettingsView.vue'
import ShareView from '../views/ShareView.vue'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView
  },
  {
    path: '/vehicles',
    name: 'vehicles',
    component: VehiclesView
  },
  {
    path: '/refuel-log',
    name: 'refuel-log',
    component: RefuelLogView
  },
  {
    path: '/plan-refuel',
    name: 'plan-refuel',
    component: PlanRefuelView
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView
  },
  {
    path: '/share',
    name: 'share',
    component: ShareView
  }
]

const router = createRouter({
  history: createWebHistory('/TankCopilot/app/'),
  routes
})

export default router

