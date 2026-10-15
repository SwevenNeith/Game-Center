<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createInvite, isInviteExpired, otherPlayerName, watchInvite } from '../services/invites.js'

const props = defineProps({
  invite: { type: Object, default: null },
  gameId: { type: String, required: true },
  extra: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['invite-created', 'invite-updated'])

const open = ref(false)
const loading = ref(false)
const copied = ref(false)
const errorMessage = ref('')
const now = ref(Date.now())
const rootEl = ref(null)
let stopWatch = null
let tickId = null

const current = computed(() => props.invite)
const friendName = computed(() => otherPlayerName(current.value))
const expired = computed(() => isInviteExpired(current.value))
const remainingMs = computed(() => {
  if (!current.value?.expires_at) return 0
  return Math.max(0, new Date(current.value.expires_at).getTime() - now.value)
})
const remainingLabel = computed(() => {
  const total = Math.ceil(remainingMs.value / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})

function closeMenu() {
  open.value = false
}

function onDocumentPointer(event) {
  if (!open.value) return
  if (rootEl.value && !rootEl.value.contains(event.target)) closeMenu()
}

async function onInvite() {
  open.value = true
  errorMessage.value = ''
  if (current.value && !expired.value) return

  loading.value = true
  const result = await createInvite(props.gameId, props.extra)
  loading.value = false

  if (!result.success) {
    errorMessage.value = result.message
    return
  }

  emit('invite-created', result.invite)
}

async function copyCode() {
  if (!current.value?.code) return
  try {
    await navigator.clipboard.writeText(current.value.code)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    errorMessage.value = 'Copie impossible, sélectionne le code à la main.'
  }
}

function bindWatch(invite) {
  stopWatch?.()
  stopWatch = null
  if (!invite?.id) return
  stopWatch = watchInvite(invite.id, (next) => emit('invite-updated', next))
}

watch(
  () => props.invite?.id,
  () => bindWatch(props.invite),
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  tickId = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  stopWatch?.()
  window.clearInterval(tickId)
})
</script>

<template>
  <div ref="rootEl" class="invite-menu">
    <button
      type="button"
      class="dots-btn"
      :class="{ 'dots-btn--open': open }"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Options de la partie"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="6" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="12" cy="18" r="1.7" />
      </svg>
    </button>

    <div v-if="open" class="invite-panel" role="menu">
      <p class="invite-kicker">Partie</p>
      <button type="button" class="invite-item" :disabled="loading" @click="onInvite">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 1.5A3.5 3.5 0 0 0 4.5 17v1.2A1.3 1.3 0 0 0 5.8 19.5h10.4a1.3 1.3 0 0 0 1.3-1.3V17A3.5 3.5 0 0 0 14 13.5a6.1 6.1 0 0 1-6 0ZM19 8h-1V7a1 1 0 0 0-2 0v1h-1a1 1 0 0 0 0 2h1v1a1 1 0 0 0 2 0v-1h1a1 1 0 0 0 0-2Z"
          />
        </svg>
        {{ loading ? 'Génération…' : 'Inviter un ami' }}
      </button>

      <div v-if="errorMessage" class="invite-status invite-status--error">{{ errorMessage }}</div>

      <div v-else-if="current" class="invite-status">
        <p v-if="friendName" class="invite-friend">Ami connecté : {{ friendName }}</p>
        <template v-else>
          <p class="invite-code-label">Code à envoyer</p>
          <p class="invite-code">{{ current.code }}</p>
          <p v-if="expired" class="invite-hint">Expiré — génère-en un nouveau.</p>
          <p v-else class="invite-hint">
            Encore {{ remainingLabel }} · uniquement pour ce jeu
          </p>
          <button type="button" class="copy-btn" @click="copyCode">
            {{ copied ? 'Copié' : 'Copier le code' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invite-menu {
  position: relative;
}

.dots-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--ink);
  display: grid;
  place-items: center;
  padding: 0;
  box-shadow: var(--shadow);
}

.dots-btn svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.dots-btn:hover,
.dots-btn--open {
  background: var(--teal);
  border-color: var(--teal);
  color: var(--cream);
}

.invite-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 20;
  width: min(19rem, calc(100vw - 2rem));
  padding: 0.7rem;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 22px 50px -24px color-mix(in srgb, var(--ink) 70%, transparent);
}

.invite-kicker {
  margin: 0 0 0.35rem 0.35rem;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

.invite-item,
.copy-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  font-weight: 700;
  text-align: left;
  background: transparent;
  color: var(--ink);
}

.invite-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.invite-item svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--teal);
}

.invite-item:hover {
  background: color-mix(in srgb, var(--teal) 10%, var(--surface));
}

.invite-status {
  margin-top: 0.4rem;
  padding: 0.8rem 0.8rem 0.85rem;
  border-radius: 14px;
  background: var(--surface-muted);
}

.invite-status--error {
  color: #8a3d32;
  font-size: 0.85rem;
  font-weight: 600;
}

.invite-code-label,
.invite-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-soft);
}

.invite-code {
  margin: 0.25rem 0 0.4rem;
  font-family: var(--display);
  font-size: 1.75rem;
  letter-spacing: 0.16em;
  font-weight: 600;
}

.invite-friend {
  margin: 0;
  font-weight: 700;
}

.copy-btn {
  margin-top: 0.45rem;
  background: var(--teal);
  color: var(--cream);
  text-align: center;
}

.copy-btn:hover {
  filter: brightness(1.05);
}
</style>
