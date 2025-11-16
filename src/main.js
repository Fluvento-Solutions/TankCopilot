import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Service Worker wird automatisch von Vite PWA registriert (siehe vite.config.js)
// Die Registrierung erfolgt über registerSW.js, das automatisch in index.html eingefügt wird

const app = createApp(App)
app.use(router)
app.mount('#app')

