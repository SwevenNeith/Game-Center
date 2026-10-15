<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchMatchHistory, STARTER_GAME_ID } from '../services/invites.js'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  gameId: { type: String, default: STARTER_GAME_ID },
})

const open = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const matches = ref([])

const hasMatches = computed(() => matches.value.length > 0)

function teamList(raw) {
  return Array.isArray(raw) ? raw : []
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pokemonLabel(item) {
  return item?.fr || item?.en || `#${item?.id || '?'}`
}

async function loadHistory() {
  loading.value = true
  errorMessage.value = ''
  const result = await fetchMatchHistory(props.gameId)
  loading.value = false
  if (!result.success) {
    errorMessage.value = result.message
    matches.value = []
    return
  }
  matches.value = result.matches
}

function close() {
  open.value = false
}

async function toggle() {
  open.value = !open.value
  if (open.value) await loadHistory()
}

function onKey(event) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="history-menu">
    <button
      type="button"
      class="icon-btn"
      :class="{ 'icon-btn--open': open }"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Historique des équipes"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 4v5.2l3.4 2-1 1.7L11 13V7h2Z"
        />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="open" class="overlay" @click.self="close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="history-title">
          <header class="dialog-head">
            <div>
              <p class="kicker">Archives</p>
              <h3 id="history-title">Face à face</h3>
            </div>
            <button type="button" class="close-btn" aria-label="Fermer l’historique" @click="close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"
                />
              </svg>
            </button>
          </header>

          <p v-if="loading" class="hint">Chargement des archives…</p>
          <p v-else-if="errorMessage" class="hint hint--error">{{ errorMessage }}</p>
          <p v-else-if="!hasMatches" class="hint">Aucune confrontation enregistrée pour l’instant.</p>

          <ul v-else class="arenas">
            <li v-for="match in matches" :key="match.id" class="arena">
              <p class="arena-date">{{ formatDate(match.created_at) }}</p>
              <div class="arena-grid">
                <article class="side">
                  <p class="side-role">Hôte</p>
                  <h4>{{ match.host_name }}</h4>
                  <ul class="roster">
                    <li v-for="(item, index) in teamList(match.host_team)" :key="`${match.id}-h-${item.id || index}`">
                      <img
                        :src="starterArtworkUrl(item.id)"
                        :alt="pokemonLabel(item)"
                        :title="pokemonLabel(item)"
                      />
                    </li>
                  </ul>
                </article>

                <div class="vs" aria-hidden="true">
                  <span>VS</span>
                </div>

                <article class="side">
                  <p class="side-role">Invité</p>
                  <h4>{{ match.guest_name }}</h4>
                  <ul class="roster">
                    <li v-for="(item, index) in teamList(match.guest_team)" :key="`${match.id}-g-${item.id || index}`">
                      <img
                        :src="starterArtworkUrl(item.id)"
                        :alt="pokemonLabel(item)"
                        :title="pokemonLabel(item)"
                      />
                    </li>
                  </ul>
                </article>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.history-menu {
  position: relative;
}

.icon-btn,
.close-btn {
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

.icon-btn svg,
.close-btn svg {
  width: 22px;
  height: 22px;
}

.icon-btn:hover,
.icon-btn--open,
.close-btn:hover {
  background: var(--teal);
  border-color: var(--teal);
  color: var(--cream);
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: color-mix(in srgb, var(--ink) 46%, transparent);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.dialog {
  width: min(640px, 100%);
  max-height: min(86vh, 820px);
  overflow: auto;
  background:
    radial-gradient(520px 180px at 12% -10%, color-mix(in srgb, var(--teal) 22%, transparent), transparent 70%),
    radial-gradient(420px 160px at 100% 0%, color-mix(in srgb, var(--brown) 18%, transparent), transparent 65%),
    var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: 0 28px 70px -28px color-mix(in srgb, var(--ink) 75%, transparent);
  padding: 1.15rem 1.15rem 1.3rem;
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--teal);
}

h3 {
  margin: 0.1rem 0 0;
  font-family: var(--display);
  font-size: clamp(1.7rem, 4vw, 2.2rem);
  font-weight: 600;
}

.hint {
  margin: 1rem 0 0;
  color: var(--text-soft);
}

.hint--error {
  color: #8a3d32;
  font-weight: 600;
}

.arenas {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.7rem;
}

.arena {
  border-radius: 18px;
  padding: 0.7rem 0.8rem 0.8rem;
  background: color-mix(in srgb, var(--cream) 55%, white);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
}

.arena-date {
  margin: 0 0 0.45rem;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--brown);
}

.arena-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.45rem;
  align-items: center;
}

.arena-grid .side:last-of-type {
  text-align: right;
}

.side h4 {
  margin: 0.05rem 0 0.4rem;
  font-family: var(--display);
  font-size: 1.05rem;
  font-weight: 600;
}

.side-role {
  margin: 0;
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--teal);
}

.roster {
  list-style: none;
  margin: 0;
  padding: 0.2rem 0.25rem;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.1rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--teal) 10%, var(--surface-muted));
}

.roster li {
  flex: 1 1 0;
  min-width: 0;
  display: grid;
  place-items: center;
}

.roster img {
  width: 100%;
  max-width: 44px;
  height: 44px;
  object-fit: contain;
}

.vs {
  align-self: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ink);
  color: var(--cream);
  font-family: var(--display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: 0 10px 22px -12px var(--ink);
}

@media (max-width: 720px) {
  .dialog {
    width: 100%;
    max-height: 88vh;
    border-radius: 22px;
  }

  .arena-grid {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }

  .arena-grid .side:last-of-type {
    text-align: left;
  }

  .vs {
    justify-self: center;
    width: 36px;
    height: 36px;
    font-size: 0.72rem;
  }

  .roster img {
    max-width: 40px;
    height: 40px;
  }
}
</style>
