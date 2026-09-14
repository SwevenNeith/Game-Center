<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  listerAppareilsLies,
  renommerAppareil,
  supprimerAppareil,
  testerNotificationPush,
} from '../services/notifications.js'

const open = ref(false)
const devices = ref([])
const selectedIds = ref([])
const loading = ref(false)
const sending = ref(false)
const renamingId = ref(null)
const renameValue = ref('')
const savingRename = ref(false)
const pendingDeleteId = ref(null)
const deletingId = ref(null)
const message = ref('')
const errorMessage = ref('')
const loadError = ref('')
const rootEl = ref(null)
const renameInputEl = ref(null)

const hasDevices = computed(() => devices.value.length > 0)
const selectedCount = computed(() => selectedIds.value.length)
const allSelected = computed(
  () => hasDevices.value && selectedIds.value.length === devices.value.length,
)

function resetFeedback() {
  message.value = ''
  errorMessage.value = ''
}

async function loadDevices() {
  loading.value = true
  loadError.value = ''
  const result = await listerAppareilsLies()
  loading.value = false

  if (!result.success) {
    loadError.value = result.error || 'Impossible de charger les appareils liés.'
    devices.value = []
    selectedIds.value = []
    return
  }

  devices.value = result.devices
  const availableIds = new Set(result.devices.map((device) => device.id))
  const kept = selectedIds.value.filter((id) => availableIds.has(id))
  selectedIds.value = kept.length ? kept : result.devices.map((device) => device.id)
}

async function toggleOpen() {
  open.value = !open.value
  resetFeedback()
  pendingDeleteId.value = null
  renamingId.value = null
  if (open.value) await loadDevices()
}

function closePanel() {
  open.value = false
  pendingDeleteId.value = null
  renamingId.value = null
}

function onDocumentPointer(event) {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(event.target)) closePanel()
}

function onKeydown(event) {
  if (event.key === 'Escape') closePanel()
}

function toggleDevice(id) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : devices.value.map((device) => device.id)
}

async function onTest() {
  resetFeedback()
  if (!selectedIds.value.length) {
    errorMessage.value = 'Choisis au moins un appareil.'
    return
  }

  sending.value = true
  const result = await testerNotificationPush({
    title: 'Game Center',
    body: 'Notification test',
    subscriptionIds: [...selectedIds.value],
  })
  sending.value = false

  if (result.success) {
    const count = selectedIds.value.length
    message.value =
      count === 1
        ? 'Notification test envoyée à l’appareil sélectionné.'
        : `Notification test envoyée à ${count} appareils.`
    return
  }

  errorMessage.value = "Échec de l'envoi — vérifie le déploiement de l'Edge Function."
}

async function startRename(device) {
  pendingDeleteId.value = null
  renamingId.value = device.id
  renameValue.value = device.nom
  await nextTick()
  renameInputEl.value?.focus()
  renameInputEl.value?.select()
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

async function saveRename(device) {
  resetFeedback()
  savingRename.value = true
  const result = await renommerAppareil(device.id, renameValue.value)
  savingRename.value = false

  if (!result.success) {
    errorMessage.value = result.message || 'Impossible de renommer cet appareil.'
    return
  }

  renamingId.value = null
  message.value = 'Appareil renommé.'
  await loadDevices()
}

async function confirmDelete(device) {
  pendingDeleteId.value = device.id
  renamingId.value = null
}

async function deleteDevice(device) {
  resetFeedback()
  deletingId.value = device.id
  const result = await supprimerAppareil(device.id)
  deletingId.value = null
  pendingDeleteId.value = null

  if (!result.success) {
    errorMessage.value = result.message || 'Impossible de supprimer cet appareil.'
    return
  }

  message.value = result.isCurrent
    ? 'Cet appareil a été délié. Tu peux l’autoriser à nouveau.'
    : 'Appareil supprimé.'
  await loadDevices()
}

onMounted(() => {
  loadDevices()
  document.addEventListener('pointerdown', onDocumentPointer)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('gamecenter-notifications-granted', loadDevices)
  window.addEventListener('gamecenter-devices-updated', loadDevices)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('gamecenter-notifications-granted', loadDevices)
  window.removeEventListener('gamecenter-devices-updated', loadDevices)
})
</script>

<template>
  <div ref="rootEl" class="notif-menu">
    <button
      type="button"
      class="bell-btn"
      :class="{ 'bell-btn--open': open }"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Notifications et appareils"
      @click="toggleOpen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-6.2V11a7 7 0 1 0-14 0v4.8L3 18v1h18v-1l-2-2.2Z"
        />
      </svg>
      <span v-if="hasDevices" class="bell-dot" aria-hidden="true"></span>
    </button>

    <div v-if="open" class="notif-panel" role="dialog" aria-labelledby="notif-panel-title">
      <div class="notif-panel__head">
        <div>
          <p class="eyebrow">Notifications</p>
          <h2 id="notif-panel-title">Appareils liés</h2>
        </div>
        <button type="button" class="icon-btn" aria-label="Fermer" @click="closePanel">×</button>
      </div>

      <p class="notif-panel__desc">Teste, renomme ou retire un appareil.</p>

      <p v-if="loadError" class="feedback feedback--error">{{ loadError }}</p>
      <p v-else-if="loading && !hasDevices" class="notif-panel__empty">Chargement…</p>
      <p v-else-if="!hasDevices" class="notif-panel__empty">
        Aucun appareil lié. Utilise le formulaire ci-dessous pour en autoriser un.
      </p>

      <div v-else class="devices-list">
        <label class="device-row device-row--all">
          <input type="checkbox" :checked="allSelected" @change="toggleAll" />
          <span>Tous ({{ devices.length }})</span>
        </label>

        <article v-for="device in devices" :key="device.id" class="device-card">
          <label class="device-row">
            <input
              type="checkbox"
              :checked="selectedIds.includes(device.id)"
              @change="toggleDevice(device.id)"
            />
            <span>
              <strong>{{ device.label }}</strong>
              <small v-if="device.createdAt">
                {{
                  new Date(device.createdAt).toLocaleString('fr-FR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                }}
              </small>
            </span>
          </label>

          <div v-if="renamingId === device.id" class="device-edit">
            <input
              ref="renameInputEl"
              v-model="renameValue"
              type="text"
              maxlength="80"
              aria-label="Nouveau nom"
              @keydown.enter.prevent="saveRename(device)"
              @keydown.esc.prevent="cancelRename"
            />
            <button type="button" class="tiny-btn tiny-btn--primary" :disabled="savingRename" @click="saveRename(device)">
              {{ savingRename ? '…' : 'OK' }}
            </button>
            <button type="button" class="tiny-btn" @click="cancelRename">Annuler</button>
          </div>

          <div v-else-if="pendingDeleteId === device.id" class="device-edit">
            <p>Supprimer {{ device.isCurrent ? 'cet appareil' : 'cet appareil de la liste' }} ?</p>
            <button
              type="button"
              class="tiny-btn tiny-btn--danger"
              :disabled="deletingId === device.id"
              @click="deleteDevice(device)"
            >
              {{ deletingId === device.id ? '…' : 'Supprimer' }}
            </button>
            <button type="button" class="tiny-btn" @click="pendingDeleteId = null">Annuler</button>
          </div>

          <div v-else class="device-tools">
            <button type="button" class="tiny-btn" @click="startRename(device)">Renommer</button>
            <button type="button" class="tiny-btn tiny-btn--danger" @click="confirmDelete(device)">
              Supprimer
            </button>
          </div>
        </article>
      </div>

      <button
        type="button"
        class="primary-btn"
        :disabled="sending || !selectedCount"
        @click="onTest"
      >
        {{ sending ? 'Envoi…' : 'Tester la sélection' }}
      </button>

      <p v-if="message" class="feedback feedback--ok">{{ message }}</p>
      <p v-if="errorMessage" class="feedback feedback--error">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.notif-menu {
  position: relative;
}

.bell-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border: 1px solid color-mix(in srgb, var(--cream) 28%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--cream) 10%, transparent);
  color: var(--cream);
  display: grid;
  place-items: center;
  padding: 0;
}

.bell-btn svg {
  width: 22px;
  height: 22px;
}

.bell-btn--open,
.bell-btn:hover {
  background: var(--teal);
  border-color: var(--teal);
}

.bell-dot {
  position: absolute;
  top: 8px;
  right: 9px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teal);
  box-shadow: 0 0 0 2px var(--ink);
}

.bell-btn--open .bell-dot,
.bell-btn:hover .bell-dot {
  background: var(--cream);
  box-shadow: 0 0 0 2px var(--teal);
}

.notif-panel {
  position: absolute;
  top: calc(100% + 0.7rem);
  right: 0;
  z-index: 40;
  width: min(24rem, calc(100vw - 1.5rem));
  max-height: min(78svh, 36rem);
  overflow: auto;
  padding: 1rem 1rem 1.1rem;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--taupe) 80%, var(--brown));
  border-radius: 18px;
  box-shadow: 0 22px 50px -24px color-mix(in srgb, var(--ink) 70%, transparent);
}

.notif-panel__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.eyebrow {
  margin: 0 0 0.15rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

h2 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.25rem;
  font-weight: 600;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  font-size: 1.4rem;
  line-height: 1;
}

.notif-panel__desc,
.notif-panel__empty {
  margin: 0.4rem 0 0;
  color: var(--text-soft);
  font-size: 0.88rem;
}

.devices-list {
  display: grid;
  gap: 0.55rem;
  margin: 0.9rem 0 0.85rem;
}

.device-card {
  border-radius: 14px;
  background: var(--surface-muted);
  padding: 0.15rem 0.15rem 0.55rem;
}

.device-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.65rem 0.7rem 0.4rem;
}

.device-row--all {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 14px;
  background: color-mix(in srgb, var(--teal) 10%, var(--surface));
  font-weight: 700;
}

.device-row input {
  margin-top: 0.2rem;
  accent-color: var(--teal);
}

.device-row span {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.device-row small {
  color: var(--text-soft);
  font-weight: 500;
}

.device-tools,
.device-edit {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  padding: 0 0.7rem;
}

.device-edit p {
  margin: 0;
  width: 100%;
  font-size: 0.82rem;
  font-weight: 600;
}

.device-edit input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.45rem 0.6rem;
  background: var(--cream);
  font-size: 16px;
}

.tiny-btn,
.primary-btn {
  border-radius: 10px;
  border: 1px solid transparent;
  min-height: 36px;
  padding: 0.35rem 0.7rem;
  font-weight: 700;
  font-size: 0.8rem;
}

.tiny-btn {
  background: transparent;
  color: var(--ink);
  border-color: color-mix(in srgb, var(--taupe) 70%, var(--brown));
}

.tiny-btn--primary,
.primary-btn {
  background: var(--teal);
  color: var(--cream);
}

.tiny-btn--danger {
  color: #8a3d32;
  border-color: color-mix(in srgb, #8a3d32 40%, var(--taupe));
}

.primary-btn {
  width: 100%;
  min-height: 44px;
  font-size: 0.92rem;
}

.primary-btn:disabled {
  opacity: 0.6;
}

.feedback {
  margin: 0.7rem 0 0;
  font-size: 0.85rem;
  font-weight: 600;
}

.feedback--ok {
  color: var(--teal);
}

.feedback--error {
  color: #8a3d32;
}

@media (max-width: 720px) {
  .notif-panel {
    position: fixed;
    top: auto;
    right: 0.75rem;
    left: 0.75rem;
    bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
    width: auto;
    max-height: min(76svh, 34rem);
  }
}
</style>
