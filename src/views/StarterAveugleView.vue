<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InfoFlagsPanel from '../components/InfoFlagsPanel.vue'
import InviteFriendMenu from '../components/InviteFriendMenu.vue'
import MatchHistoryMenu from '../components/MatchHistoryMenu.vue'
import PokemonFiche from '../components/PokemonFiche.vue'
import PokemonPreviewInfo from '../components/PokemonPreviewInfo.vue'
import StarterDraw from '../components/StarterDraw.vue'
import {
  fetchActiveInviteForDevice,
  fetchInviteByCode,
  fetchInviteById,
  forgetGameSession,
  isActiveGame,
  isInviteExpired,
  joinInvite,
  localPlayerName,
  localPlayerRole,
  otherPlayerName,
  purgeExpiredInvites,
  rememberGameSession,
  saveCompletedMatch,
  STARTER_GAME_ID,
  updateInvite,
} from '../services/invites.js'
import {
  fillFrenchNames,
  getPokemonDetails,
  loadPokedexIndex,
  resolveStartersByIds,
  searchPokemon,
  starterArtworkUrl,
} from '../services/pokeapi.js'
import {
  completeRound,
  dealRound,
  defaultInfoFlags,
  emptyGameState,
  isEnded,
  isInfoPhase,
  isPicking,
  needsDeal,
  parseGameState,
  withInfoFlag,
  withLie,
  withPlayerName,
} from '../services/starterAveugle.js'

const route = useRoute()
const router = useRouter()

const invite = ref(null)
const inviteError = ref('')
const endedNotice = ref('')
const query = ref('')
const suggestions = ref([])
const searching = ref(false)
const selected = ref(null)
const loadingDetails = ref(false)
const detailsError = ref('')
const indexReady = ref(false)
const pokedex = ref([])
const startersError = ref('')
const nameDraft = ref('')
const enteredName = ref('')
const savingName = ref(false)
const savingPick = ref(false)
const savingStart = ref(false)
const localFlags = ref(defaultInfoFlags())
const detailsById = ref({})
const lieSearchOpen = ref(false)
const assigningLie = ref(false)
const pendingLie = ref(null)
const lieError = ref('')
const savingLie = ref(false)
let searchTimer = null
let skipNextSearch = false
let hostWriteChain = Promise.resolve()

function enqueueHostWrite(task) {
  const run = hostWriteChain.then(task)
  hostWriteChain = run.catch(() => {})
  return run
}

async function latestInvite(fallback) {
  if (!fallback?.id) return fallback
  const latest = await fetchInviteById(fallback.id)
  return latest.success ? latest.invite : fallback
}

const gameState = computed(() => parseGameState(invite.value))
const myRole = computed(() => localPlayerRole(invite.value))
const mySavedName = computed(
  () => localPlayerName(invite.value) || enteredName.value,
)
const friendName = computed(() => otherPlayerName(invite.value))
const guestJoined = computed(() => Boolean(invite.value?.guest_device_id))
const waitingForFriend = computed(
  () => Boolean(invite.value && !guestJoined.value && !isInviteExpired(invite.value)),
)
const waitingForFriendName = computed(
  () => Boolean(invite.value && guestJoined.value && !friendName.value),
)
const gameOver = computed(() => gameState.value.status === 'done')
const myPick = computed(() => {
  if (!invite.value || !myRole.value) return null
  return myRole.value === 'host' ? invite.value.host_pick : invite.value.guest_pick
})
const theirPick = computed(() => {
  if (!invite.value || !myRole.value) return null
  return myRole.value === 'host' ? invite.value.guest_pick : invite.value.host_pick
})
const myProposals = computed(() => {
  if (!myRole.value) return []
  return resolveStartersByIds(pokedex.value, gameState.value[myRole.value]?.proposals)
})
const myTeam = computed(() => {
  if (!myRole.value) return []
  return resolveStartersByIds(pokedex.value, gameState.value[myRole.value]?.team)
})
const theirTeam = computed(() => {
  if (!myRole.value) return []
  const other = myRole.value === 'host' ? 'guest' : 'host'
  return resolveStartersByIds(pokedex.value, gameState.value[other]?.team)
})
const myLie = computed(() => {
  if (!myRole.value) return null
  const id = gameState.value[myRole.value]?.lieId
  if (!id) return null
  return resolveStartersByIds(pokedex.value, [id])[0] || { id: Number(id) }
})
const myLieUnderId = computed(() => {
  if (!myRole.value) return null
  const id = gameState.value[myRole.value]?.lieUnderId
  return id ? Number(id) : null
})
const detailsNeeded = computed(() => {
  const ids = myProposals.value.map((item) => item.id)
  if (myLie.value?.id) ids.push(myLie.value.id)
  if (pendingLie.value?.id) ids.push(pendingLie.value.id)
  if (selected.value?.id) ids.push(selected.value.id)
  return [...new Set(ids.filter(Boolean))]
})
const picking = computed(() => isPicking(gameState.value))
const infoPhase = computed(() => Boolean(invite.value && isInfoPhase(gameState.value)))
const showFlags = computed(
  () => !gameOver.value && !picking.value && Boolean(mySavedName.value || invite.value),
)
const showDraw = computed(
  () => picking.value && !gameOver.value && myProposals.value.length === 3,
)
const dealing = computed(
  () => picking.value && !gameOver.value && myProposals.value.length !== 3,
)
const infoFlags = computed(() =>
  invite.value ? gameState.value.infoFlags : localFlags.value,
)
const flagsEditable = computed(
  () => (!myRole.value || myRole.value === 'host') && !picking.value && !gameOver.value,
)

const inviteExtra = computed(() => {
  const state = emptyGameState()
  state.host.playerName = mySavedName.value
  state.infoFlags = { ...infoFlags.value }
  return {
    host_name: mySavedName.value || 'Hôte',
    game_state: state,
  }
})

function syncInviteQuery(next) {
  const code = next?.code
  if (code && route.query.code !== code) {
    router.replace({ query: { ...route.query, code } })
    return
  }
  if (!code && route.query.code) {
    const nextQuery = { ...route.query }
    delete nextQuery.code
    router.replace({ query: nextQuery })
  }
}

function applyInvite(next, options = {}) {
  if (!next || isEnded(parseGameState(next))) {
    if (invite.value) {
      forgetGameSession(STARTER_GAME_ID)
      if (!options.silent) {
        endedNotice.value = 'La partie a été terminée. Les deux appareils sont déconnectés.'
      }
    }
    invite.value = null
    syncInviteQuery(null)
    return
  }

  endedNotice.value = ''
  rememberGameSession(STARTER_GAME_ID, next)
  invite.value = next
  syncInviteQuery(next)
  if (!options.skipAdvance) maybeHostAdvance(next)
}

async function persistMatchIfDone(nextInvite) {
  if (!nextInvite || !pokedex.value.length) return
  const saved = await saveCompletedMatch(nextInvite, pokedex.value)
  if (saved.invite) invite.value = saved.invite
  else if (!saved.success) startersError.value = saved.message
}

async function confirmInfo() {
  if (!invite.value || myRole.value !== 'host' || !infoPhase.value || !pokedex.value.length) return
  savingStart.value = true
  await enqueueHostWrite(async () => {
    const current = await latestInvite(invite.value)
    const state = parseGameState(current)
    if (!isInfoPhase(state)) return
    const result = await updateInvite(current.id, {
      game_state: dealRound(state, pokedex.value),
    })
    if (result.success) invite.value = result.invite
    else startersError.value = result.message
  })
  savingStart.value = false
}

function onToggleFlag(fieldId, enabled) {
  if (!flagsEditable.value) return
  if (!invite.value) {
    localFlags.value = { ...localFlags.value, [fieldId]: enabled }
    return
  }
  enqueueHostWrite(async () => {
    const current = await latestInvite(invite.value)
    const result = await updateInvite(current.id, {
      game_state: withInfoFlag(parseGameState(current), fieldId, enabled),
    })
    if (result.success) invite.value = result.invite
    else startersError.value = result.message
  })
}

async function maybeHostAdvance(nextInvite) {
  if (!nextInvite || !pokedex.value.length) return
  const incoming = parseGameState(nextInvite)
  if (isEnded(incoming)) return

  if (incoming.status === 'done') {
    await persistMatchIfDone(nextInvite)
    return
  }

  if (localPlayerRole(nextInvite) !== 'host') return

  await enqueueHostWrite(async () => {
    const current = await latestInvite(nextInvite)
    const state = parseGameState(current)

    if (state.status === 'done') {
      await persistMatchIfDone(current)
      return
    }

    if (needsDeal(state)) {
      const result = await updateInvite(current.id, {
        game_state: dealRound(state, pokedex.value),
      })
      if (result.success) invite.value = result.invite
      else startersError.value = result.message
      return
    }

    if (state.status === 'picking' && current.host_pick && current.guest_pick) {
      const result = await updateInvite(current.id, {
        game_state: completeRound(state, current.host_pick, current.guest_pick, pokedex.value),
        host_pick: null,
        guest_pick: null,
      })
      if (result.success) {
        invite.value = result.invite
        if (parseGameState(result.invite).status === 'done') {
          await persistMatchIfDone(result.invite)
        }
      } else {
        startersError.value = result.message
      }
    }
  })
}

async function submitName() {
  const name = nameDraft.value.trim()
  if (!name) return
  enteredName.value = name
  if (!invite.value || !myRole.value) return

  savingName.value = true
  const state = withPlayerName(parseGameState(invite.value), myRole.value, name)
  const field = myRole.value === 'host' ? 'host_name' : 'guest_name'
  const result = await updateInvite(invite.value.id, {
    [field]: name,
    game_state: state,
  })
  savingName.value = false
  if (!result.success) {
    startersError.value = result.message
    return
  }
  invite.value = result.invite
  await maybeHostAdvance(result.invite)
}

function resetLieSearch() {
  lieSearchOpen.value = false
  assigningLie.value = false
  pendingLie.value = null
  lieError.value = ''
  query.value = ''
  selected.value = null
  suggestions.value = []
}

function startLieSearch() {
  if (myPick.value || myLie.value) return
  lieError.value = ''
  assigningLie.value = false
  pendingLie.value = null
  query.value = ''
  selected.value = null
  suggestions.value = []
  lieSearchOpen.value = true
}

function chooseAsLie() {
  if (!selected.value || myPick.value) return
  const id = Number(selected.value.id)
  if (myProposals.value.some((item) => Number(item.id) === id)) {
    lieError.value = 'Le mensonge doit être différent des 3 Pokémon aléatoires.'
    return
  }
  lieError.value = ''
  pendingLie.value = selected.value
  detailsById.value = { ...detailsById.value, [id]: selected.value }
  lieSearchOpen.value = false
  assigningLie.value = true
}

async function placeLie(underId) {
  if (!pendingLie.value || !invite.value || !myRole.value || savingLie.value || myPick.value) return
  const lieId = Number(pendingLie.value.id)
  if (myProposals.value.some((item) => Number(item.id) === lieId)) {
    lieError.value = 'Le mensonge doit être différent des 3 Pokémon aléatoires.'
    assigningLie.value = false
    lieSearchOpen.value = true
    return
  }
  savingLie.value = true
  const latest = await latestInvite(invite.value)
  const result = await updateInvite(latest.id, {
    game_state: withLie(parseGameState(latest), myRole.value, lieId, underId),
  })
  savingLie.value = false
  if (!result.success) {
    startersError.value = result.message
    return
  }
  invite.value = result.invite
  assigningLie.value = false
  pendingLie.value = null
  lieError.value = ''
}

async function pickForFriend(pokemonId) {
  if (assigningLie.value) return
  if (myLie.value && Number(pokemonId) === Number(myLie.value.id)) return
  if (!invite.value || !myRole.value || myPick.value || savingPick.value) return
  savingPick.value = true
  const field = myRole.value === 'host' ? 'host_pick' : 'guest_pick'
  const result = await updateInvite(invite.value.id, { [field]: pokemonId })
  savingPick.value = false
  if (!result.success) {
    startersError.value = result.message
    return
  }
  invite.value = result.invite
  await maybeHostAdvance(result.invite)
}

function onInviteCreated(next) {
  applyInvite(next)
}

function onInviteUpdated(next) {
  applyInvite(next)
}

function onInviteEnded(next) {
  applyInvite(next || null)
}

async function restoreSession() {
  if (route.query.code) {
    const joined = await joinInvite(String(route.query.code), STARTER_GAME_ID)
    if (joined.success) {
      applyInvite(joined.invite, { skipAdvance: true })
      inviteError.value = ''
      return
    }
    const fetched = await fetchInviteByCode(String(route.query.code))
    if (fetched.success) {
      if (fetched.invite.game_id !== STARTER_GAME_ID) {
        inviteError.value = 'Ce code n’est valable que pour un autre jeu.'
        return
      }
      applyInvite(fetched.invite, { skipAdvance: true })
      inviteError.value = ''
      return
    }
  }

  const active = await fetchActiveInviteForDevice(STARTER_GAME_ID)
  if (active.success && active.invite) {
    applyInvite(active.invite, { skipAdvance: true })
    inviteError.value = ''
    return
  }

  if (route.query.code) {
    inviteError.value = 'Cette partie n’est plus disponible. Tu peux en lancer une nouvelle.'
  }
}

function scheduleSearch(value) {
  window.clearTimeout(searchTimer)
  if (!value.trim()) {
    suggestions.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = window.setTimeout(async () => {
    try {
      suggestions.value = await searchPokemon(value, 10)
    } catch (err) {
      detailsError.value = err.message || 'Recherche PokéAPI impossible.'
      suggestions.value = []
    } finally {
      searching.value = false
    }
  }, 220)
}

watch(invite, (next) => {
  if (next && isActiveGame(next)) rememberGameSession(STARTER_GAME_ID, next)
  else forgetGameSession(STARTER_GAME_ID)
})

watch(query, (value) => {
  if (skipNextSearch) {
    skipNextSearch = false
    return
  }
  scheduleSearch(value)
})

watch(
  detailsNeeded,
  async (ids) => {
    const missing = ids.filter((id) => !detailsById.value[id])
    if (!missing.length) return
    const loaded = await Promise.all(
      missing.map(async (id) => {
        try {
          return [id, await getPokemonDetails(id)]
        } catch {
          return null
        }
      }),
    )
    const next = { ...detailsById.value }
    for (const entry of loaded) {
      if (entry) next[entry[0]] = entry[1]
    }
    detailsById.value = next
  },
  { immediate: true },
)

watch(
  () => gameState.value.round,
  () => {
    resetLieSearch()
  },
)

async function selectPokemon(entry) {
  loadingDetails.value = true
  detailsError.value = ''
  suggestions.value = []
  skipNextSearch = true
  query.value = entry.fr || entry.en || entry.slug
  try {
    selected.value = await getPokemonDetails(entry.id)
  } catch (err) {
    detailsError.value = err.message || 'Impossible de charger ce Pokémon.'
    selected.value = null
  } finally {
    loadingDetails.value = false
  }
}

async function onSubmit() {
  if (suggestions.value[0]) {
    await selectPokemon(suggestions.value[0])
    return
  }
  if (!query.value.trim()) return
  const results = await searchPokemon(query.value, 1)
  if (results[0]) await selectPokemon(results[0])
  else detailsError.value = 'Aucun Pokémon trouvé.'
}

onMounted(async () => {
  await purgeExpiredInvites()
  try {
    pokedex.value = await loadPokedexIndex()
    indexReady.value = true
    fillFrenchNames()
  } catch {
    detailsError.value = 'Impossible de charger le Pokédex (PokéAPI).'
    return
  }

  await restoreSession()
  if (localPlayerName(invite.value)) {
    enteredName.value = localPlayerName(invite.value)
    nameDraft.value = enteredName.value
  }
  await maybeHostAdvance(invite.value)
})

onUnmounted(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="game-page">
    <header class="game-bar">
      <div class="game-logo" aria-hidden="true"></div>
      <div class="game-bar__titles">
        <p class="eyebrow">Jeu</p>
        <h2>Starter à l’aveugle</h2>
      </div>
      <div class="game-bar__actions">
        <MatchHistoryMenu :game-id="STARTER_GAME_ID" />
        <InviteFriendMenu
          :game-id="STARTER_GAME_ID"
          :invite="invite"
          :extra="inviteExtra"
          @invite-created="onInviteCreated"
          @invite-updated="onInviteUpdated"
          @invite-ended="onInviteEnded"
        />
      </div>
    </header>

    <p v-if="friendName" class="friend-banner friend-banner--ok">
      Ami connecté : <strong>{{ friendName }}</strong>
    </p>
    <p v-else-if="waitingForFriendName" class="friend-banner">
      Un ami a rejoint — en attente de son nom.
    </p>
    <p v-else-if="waitingForFriend" class="friend-banner">
      En attente d’un ami · code {{ invite.code }}
    </p>
    <p v-else-if="inviteError" class="friend-banner friend-banner--error">{{ inviteError }}</p>
    <p v-if="endedNotice" class="friend-banner">{{ endedNotice }}</p>
    <p v-if="startersError" class="friend-banner friend-banner--error">{{ startersError }}</p>

    <section v-if="!mySavedName" class="name-card" aria-labelledby="name-title">
      <h3 id="name-title">Ton nom</h3>
      <p class="dex-desc">Il s’affichera chez ton ami comme joueur connecté.</p>
      <form class="search" @submit.prevent="submitName">
        <label class="sr-only" for="player-name">Ton nom</label>
        <input
          id="player-name"
          v-model="nameDraft"
          type="text"
          maxlength="24"
          autocomplete="nickname"
          placeholder="Ex. Léa"
        />
        <button type="submit" :disabled="savingName || nameDraft.trim().length < 2">
          {{ savingName ? 'Enregistrement…' : 'Valider' }}
        </button>
      </form>
    </section>

    <p v-else-if="!invite" class="friend-banner">
      Invite un ami via les trois points pour lancer les 6 manches.
    </p>

    <InfoFlagsPanel
      v-if="showFlags"
      :flags="infoFlags"
      :editable="flagsEditable"
      @toggle="onToggleFlag"
    >
      <template v-if="infoPhase" #footer>
        <button
          v-if="flagsEditable"
          type="button"
          class="start-btn"
          :disabled="savingStart"
          @click="confirmInfo"
        >
          {{ savingStart ? 'Lancement…' : 'Lancer les 6 manches' }}
        </button>
        <p v-else class="flags-wait">
          L’hôte choisit les infos, puis lance les Pokémon. Tu ne les vois pas encore.
        </p>
      </template>
    </InfoFlagsPanel>

    <StarterDraw
      v-if="showDraw"
      :pokemon="myProposals"
      :details-by-id="detailsById"
      :flags="infoFlags"
      :friend-name="friendName"
      :round="gameState.round"
      :picked-id="myPick"
      :waiting="Boolean(myPick) && !theirPick"
      :disabled="savingPick || savingLie"
      :lie="myLie"
      :lie-under-id="myLieUnderId"
      :searching-lie="lieSearchOpen"
      :assigning-lie="assigningLie"
      @pick="pickForFriend"
      @start-lie="startLieSearch"
      @place-lie="placeLie"
    >
      <template #lie-search>
        <p class="dex-desc">Cherche un Pokémon différent des 3 propositions, puis choisis-le comme mensonge.</p>
        <form class="search" @submit.prevent="onSubmit">
          <label class="sr-only" for="pokemon-search">Rechercher un Pokémon</label>
          <input
            id="pokemon-search"
            v-model="query"
            type="search"
            placeholder="Dracaufeu, Pikachu, 25…"
            autocomplete="off"
          />
          <button type="submit">Chercher</button>
        </form>
        <p v-if="searching" class="hint">Recherche…</p>
        <ul v-if="suggestions.length" class="suggestions">
          <li v-for="item in suggestions" :key="item.id">
            <button type="button" @click="selectPokemon(item)">
              <span class="num">#{{ String(item.id).padStart(4, '0') }}</span>
              <span>{{ item.fr || item.en }}</span>
            </button>
          </li>
        </ul>
        <p v-if="lieError || detailsError" class="error">{{ lieError || detailsError }}</p>
        <p v-else-if="loadingDetails" class="hint">Chargement de la fiche…</p>
        <div v-if="selected && !loadingDetails" class="lie-choice">
          <div class="pick-preview">
            <img :src="starterArtworkUrl(selected.id)" alt="" />
            <PokemonPreviewInfo :pokemon="selected" :flags="infoFlags" />
          </div>
          <button type="button" class="lie-confirm" @click="chooseAsLie">Choisir comme mensonge</button>
        </div>
        <button type="button" class="lie-cancel" @click="resetLieSearch">Annuler</button>
      </template>
    </StarterDraw>
    <p v-else-if="dealing" class="friend-banner">Préparation de la manche…</p>

    <section v-if="gameOver" class="draw-result" aria-labelledby="teams-title">
      <h3 id="teams-title">Les 6 Pokémon choisis</h3>
      <p class="dex-desc">Seules ces équipes sont conservées.</p>
      <div class="teams">
        <div>
          <h4>Pour toi · {{ mySavedName }}</h4>
          <ul>
            <li v-for="item in myTeam" :key="`me-${item.id}`">
              <img :src="starterArtworkUrl(item.id)" :alt="item.fr || item.en" />
              <span>{{ item.fr || item.en }}</span>
            </li>
          </ul>
        </div>
        <div>
          <h4>Pour {{ friendName }}</h4>
          <ul>
            <li v-for="item in theirTeam" :key="`them-${item.id}`">
              <img :src="starterArtworkUrl(item.id)" :alt="item.fr || item.en" />
              <span>{{ item.fr || item.en }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="!showDraw" class="dex" aria-labelledby="dex-title">
      <h3 id="dex-title">Pokédex</h3>
      <p class="dex-desc">
        Recherche n’importe quel Pokémon par nom français, nom anglais ou numéro.
      </p>

      <form class="search" @submit.prevent="onSubmit">
        <label class="sr-only" for="pokedex-search">Rechercher un Pokémon</label>
        <input
          id="pokedex-search"
          v-model="query"
          type="search"
          placeholder="Dracaufeu, Pikachu, 25…"
          autocomplete="off"
        />
        <button type="submit">Chercher</button>
      </form>
      <p v-if="searching" class="hint">Recherche…</p>
      <p v-else-if="!indexReady" class="hint">Chargement du Pokédex…</p>

      <ul v-if="suggestions.length" class="suggestions">
        <li v-for="item in suggestions" :key="item.id">
          <button type="button" @click="selectPokemon(item)">
            <span class="num">#{{ String(item.id).padStart(4, '0') }}</span>
            <span>{{ item.fr || item.en }}</span>
          </button>
        </li>
      </ul>

      <p v-if="detailsError" class="error">{{ detailsError }}</p>
      <p v-else-if="loadingDetails" class="hint">Chargement de la fiche…</p>

      <PokemonFiche v-if="selected && !loadingDetails" :pokemon="selected" />
    </section>
  </div>
</template>

<style scoped>
.game-page {
  --game-accent: var(--teal);
  --game-text: var(--ink);
  display: grid;
  gap: 1rem;
}

.game-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.game-bar__titles {
  flex: 1;
  min-width: 0;
}

.game-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--game-accent);
}

h2 {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 600;
}

.game-logo {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--surface-muted);
  border: 1px dashed var(--border);
}

.friend-banner {
  margin: 0;
  padding: 0.75rem 0.95rem;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.friend-banner--ok {
  background: color-mix(in srgb, var(--teal) 14%, var(--surface));
  border-color: color-mix(in srgb, var(--teal) 45%, var(--taupe));
}

.friend-banner--error {
  color: #8a3d32;
  font-weight: 600;
}

.name-card,
.draw-result {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
}

.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.teams h4 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.teams ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.teams li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 0.35rem 0.55rem;
}

.teams img {
  width: 40px;
  height: 40px;
}

.dex {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.3rem;
  box-shadow: var(--shadow);
}

h3 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.dex-desc,
.hint {
  color: var(--text-soft);
}

.dex-desc {
  margin: 0.3rem 0 0;
}

.search {
  display: flex;
  gap: 0.55rem;
  margin-top: 0.95rem;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  background: var(--cream);
  font-size: 16px;
}

.search button,
.start-btn {
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0 1rem;
  background: var(--teal);
  color: var(--cream);
  font-weight: 700;
}

.start-btn {
  width: 100%;
}

.flags-wait {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.hint {
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
}

.error {
  margin: 0.7rem 0 0;
  color: #8a3d32;
  font-weight: 600;
}

.suggestions {
  list-style: none;
  margin: 0.65rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.suggestions button {
  width: 100%;
  display: flex;
  gap: 0.7rem;
  align-items: center;
  text-align: left;
  border: none;
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
  min-height: 44px;
  background: var(--surface-muted);
}

.num {
  font-weight: 700;
  color: var(--teal);
}

.lie-choice {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.65rem;
}

.pick-preview {
  background: var(--surface-muted);
  border-radius: 16px;
  padding: 0.7rem 0.7rem 0.85rem;
  text-align: left;
}

.pick-preview img {
  display: block;
  margin: 0 auto;
  max-height: 110px;
}

.lie-confirm,
.lie-cancel {
  width: 100%;
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0 1rem;
  font-weight: 700;
}

.lie-confirm {
  background: color-mix(in srgb, #8a3d32 86%, var(--ink));
  color: var(--cream);
}

.lie-cancel {
  margin-top: 0.45rem;
  background: var(--surface-muted);
  color: var(--ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 720px) {
  .search {
    flex-direction: column;
  }

  .game-bar__titles h2 {
    font-size: 1.25rem;
  }

  .teams {
    grid-template-columns: 1fr;
  }
}
</style>
