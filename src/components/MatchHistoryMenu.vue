<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BattleResults from './BattleResults.vue'
import { replaySavedTeams, resolveTeamForDisplay } from '../services/battle/index.js'
import {
  deleteAllMatches,
  deleteMatch,
  fetchMatchHistory,
  saveMatchBattleResults,
  STARTER_GAME_ID,
} from '../services/invites.js'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  gameId: { type: String, default: STARTER_GAME_ID },
})

const open = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const matches = ref([])
const runningId = ref(null)
const progressById = ref({})
const resultsById = ref({})
const confirmingId = ref(null)
const deleting = ref(false)

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

async function rerunCombat(match) {
  if (!match?.id || runningId.value) return
  runningId.value = match.id
  progressById.value = {
    ...progressById.value,
    [match.id]: { status: 'running', played: 0, progress: 0, minBattles: 40, maxBattles: 300 },
  }
  const nextResults = { ...resultsById.value }
  delete nextResults[match.id]
  resultsById.value = nextResults
  try {
    const results = await replaySavedTeams({
      hostTeam: teamList(match.host_team),
      guestTeam: teamList(match.guest_team),
      hostName: match.host_name || 'Hôte',
      guestName: match.guest_name || 'Invité',
      onProgress: (progress) => {
        const played = progress.played || 0
        progressById.value = {
          ...progressById.value,
          [match.id]: {
            status: 'running',
            played,
            hostWins: progress.hostWins,
            guestWins: progress.guestWins,
            ties: progress.ties,
            interval: progress.interval,
            minBattles: progress.minBattles,
            maxBattles: progress.maxBattles,
            progress: progress.progress || 0,
          },
        }
      },
    })
    const saved = await saveMatchBattleResults({ matchId: match.id }, results)
    const stored = saved.success ? saved.results || results : { ...results, status: 'done' }
    resultsById.value = { ...resultsById.value, [match.id]: stored }
    matches.value = matches.value.map((row) =>
      row.id === match.id ? { ...row, battle_results: stored } : row,
    )
    progressById.value = { ...progressById.value, [match.id]: null }
    if (!saved.success) errorMessage.value = saved.message
  } catch (error) {
    progressById.value = {
      ...progressById.value,
      [match.id]: { error: error.message || 'Impossible de relancer ce combat.' },
    }
  }
  runningId.value = null
}

async function loadHistory() {
  loading.value = true
  errorMessage.value = ''
  confirmingId.value = null
  const result = await fetchMatchHistory(props.gameId)
  if (!result.success) {
    loading.value = false
    errorMessage.value = result.message
    matches.value = []
    return
  }
  const resolved = await Promise.all(
    (result.matches || []).map(async (match) => ({
      ...match,
      finalsSaved: teamList(match.host_team).some((item) => item.fromId || item.pokemonId),
      host_team: await resolveTeamForDisplay(match.host_team),
      guest_team: await resolveTeamForDisplay(match.guest_team),
    })),
  )
  matches.value = resolved
  resultsById.value = Object.fromEntries(
    resolved.filter((match) => match.battle_results).map((match) => [match.id, match.battle_results]),
  )
  loading.value = false
}

function askDelete(id) {
  if (runningId.value || deleting.value) return
  confirmingId.value = confirmingId.value === id ? null : id
}

async function confirmDeleteMatch(match) {
  if (!match?.id || runningId.value === match.id || deleting.value) return
  deleting.value = true
  const result = await deleteMatch(match.id)
  deleting.value = false
  confirmingId.value = null
  if (!result.success) {
    errorMessage.value = result.message
    return
  }
  matches.value = matches.value.filter((row) => row.id !== match.id)
  const nextResults = { ...resultsById.value }
  delete nextResults[match.id]
  resultsById.value = nextResults
}

async function confirmDeleteAll() {
  if (runningId.value || deleting.value || !matches.value.length) return
  deleting.value = true
  const result = await deleteAllMatches(props.gameId)
  deleting.value = false
  confirmingId.value = null
  if (!result.success) {
    errorMessage.value = result.message
    return
  }
  matches.value = []
  resultsById.value = {}
  progressById.value = {}
}

function close() {
  open.value = false
  confirmingId.value = null
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
            <div class="dialog-actions">
              <button
                v-if="hasMatches"
                type="button"
                class="purge-btn"
                :class="{ 'purge-btn--on': confirmingId === 'all' }"
                :disabled="Boolean(runningId) || deleting"
                @click="confirmingId === 'all' ? confirmDeleteAll() : askDelete('all')"
              >
                {{ confirmingId === 'all' ? 'Confirmer tout supprimer' : 'Tout supprimer' }}
              </button>
              <button type="button" class="close-btn" aria-label="Fermer l’historique" @click="close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"
                />
              </svg>
            </button>
            </div>
          </header>

          <p v-if="loading" class="hint">Chargement des archives…</p>
          <p v-else-if="errorMessage" class="hint hint--error">{{ errorMessage }}</p>
          <p v-else-if="!hasMatches" class="hint">Aucune confrontation enregistrée pour l’instant.</p>

          <ul v-else class="arenas">
            <li v-for="match in matches" :key="match.id" class="arena">
              <div class="arena-top">
                <p class="arena-date">{{ formatDate(match.created_at) }}</p>
                <button
                  type="button"
                  class="row-del"
                  :class="{ 'row-del--on': confirmingId === match.id }"
                  :disabled="Boolean(runningId) || deleting"
                  :aria-label="confirmingId === match.id ? 'Confirmer la suppression' : 'Supprimer cette confrontation'"
                  @click="confirmingId === match.id ? confirmDeleteMatch(match) : askDelete(match.id)"
                >
                  {{ confirmingId === match.id ? 'Confirmer' : 'Supprimer' }}
                </button>
              </div>
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
              <button
                type="button"
                class="replay-btn"
                :disabled="Boolean(runningId)"
                @click="rerunCombat(match)"
              >
                {{ runningId === match.id ? 'Relance…' : 'Relancer le combat' }}
              </button>
              <p class="replay-hint">
                {{
                  match.finalsSaved
                    ? 'Évolutions telles que choisies en partie.'
                    : 'Évolutions finales (forme de base s’il y a plusieurs choix).'
                }}
              </p>
              <BattleResults
                v-if="progressById[match.id] || resultsById[match.id]"
                :title-id="`history-results-${match.id}`"
                :battle="resultsById[match.id] || progressById[match.id]"
                :host-name="match.host_name || 'Hôte'"
                :guest-name="match.guest_name || 'Invité'"
                :running="runningId === match.id"
              />
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
  width: min(720px, 100%);
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

.dialog-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.purge-btn,
.row-del {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
}

.purge-btn {
  min-height: 44px;
  border-radius: 14px;
  padding: 0 0.85rem;
  font-size: 0.82rem;
}

.row-del {
  min-height: 32px;
  border-radius: 10px;
  padding: 0 0.65rem;
  font-size: 0.74rem;
}

.purge-btn--on,
.row-del--on {
  background: #8a3d32;
  border-color: #8a3d32;
  color: var(--cream);
}

.purge-btn:disabled,
.row-del:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.arena-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.arena-date {
  margin: 0;
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

.replay-btn {
  width: 100%;
  margin-top: 0.75rem;
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0 1rem;
  background: var(--teal);
  color: var(--cream);
  font-weight: 700;
}

.replay-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.replay-hint {
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-soft);
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
