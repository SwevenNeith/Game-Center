import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Enregistre le Service Worker pour les notifications et le mode PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }

createApp(App).mount('#app')
