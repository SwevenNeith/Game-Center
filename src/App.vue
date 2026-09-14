<script setup>
import { RouterView } from 'vue-router'
import NotificationPrompt from './components/NotificationPrompt.vue'
import NotificationsMenu from './components/NotificationsMenu.vue'

function onDeviceLinked() {
  window.dispatchEvent(new CustomEvent('gamecenter-devices-updated'))
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="brand">
          <h1>Game Center</h1>
        </div>
        <NotificationsMenu />
      </div>
    </header>

    <main class="app-main">
      <NotificationPrompt @linked="onDeviceLinked" />
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100svh;
}

.app-header {
  position: relative;
  z-index: 30;
  background: var(--ink);
  color: var(--cream);
  padding: calc(0.9rem + env(safe-area-inset-top, 0px)) 1.1rem 1.05rem;
  border-bottom: 4px solid var(--teal);
}

.app-header__inner {
  width: min(1080px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.brand {
  flex: 1 1 auto;
  min-width: min-content;
}

h1 {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(1.7rem, 4.5vw, 2.5rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  white-space: nowrap;
}

.app-main {
  width: min(1080px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1.1rem 0 calc(2.2rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 1.15rem;
}

@media (max-width: 720px) {
  h1 {
    font-size: 1.7rem;
  }
}
</style>
