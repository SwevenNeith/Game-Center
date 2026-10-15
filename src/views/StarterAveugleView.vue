<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InviteFriendMenu from '../components/InviteFriendMenu.vue'
import PokemonFiche from '../components/PokemonFiche.vue'
import StarterDraw from '../components/StarterDraw.vue'
import {
  fetchInviteByCode,
  isInviteExpired,
  joinInvite,
  localPlayerName,
  localPlayerRole,
  otherPlayerName,
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
  bothNamed,
  completeRound,
  dealRound,
  emptyGameState,
  needsDeal,
  parseGameState,
  withPlayerName,
} from '../services/starterAveugle.js'

const route = useRoute()
const router = useRouter()

const invite = ref(null)
const inviteError = ref('')
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
let searchTimer = null
let skipNextSearch = false
let advancing = false

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
const gameReady = computed(() => Boolean(invite.value && bothNamed(gameState.value)))
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
const showDraw = computed(
  () => gameReady.value && !gameOver.value && myProposals.value.length === 3,
)
const dealing = computed(
  () => gameReady.value && !gameOver.value && myProposals.value.length !== 3,
)

const inviteExtra = computed(() => {
  const state = emptyGameState()
  state.host.playerName = mySavedName.value
  return {
    host_name: mySavedName.value || 'Hôte',
    game_state: state,
  }
})

async function maybeHostAdvance(nextInvite) {
  if (!pokedex.value.length) return
  if (localPlayerRole(nextInvite) !== 'host' || advancing) return

  const state = parseGameState(nextInvite)
  if (needsDeal(state)) {
    advancing = true
    const result = await updateInvite(nextInvite.id, {
      game_state: dealRound(state, pokedex.value),
    })
    advancing = false
    if (result.success) invite.value = result.invite
    else startersError.value = result.message
    return
  }

  if (state.status === 'picking' && nextInvite.host_pick && nextInvite.guest_pick) {
    advancing = true
    const result = await updateInvite(nextInvite.id, {
      game_state: completeRound(state, nextInvite.host_pick, nextInvite.guest_pick, pokedex.value),
      host_pick: null,
      guest_pick: null,
    })
    advancing = false
    if (result.success) invite.value = result.invite
    else startersError.value = result.message
  }
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

async function pickForFriend(pokemonId) {
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
  invite.value = next
  router.replace({ query: { ...route.query, code: next.code } })
  maybeHostAdvance(next)
}

function onInviteUpdated(next) {
  invite.value = next
  maybeHostAdvance(next)
}

async function restoreInviteFromQuery() {
  const code = route.query.code
  if (!code) return
  const joined = await joinInvite(String(code), STARTER_GAME_ID)
  if (joined.success) {
    invite.value = joined.invite
    inviteError.value = ''
    return
  }
  const fetched = await fetchInviteByCode(String(code))
  if (fetched.success) {
    if (fetched.invite.game_id !== STARTER_GAME_ID) {
      inviteError.value = 'Ce code n’est valable que pour un autre jeu.'
      return
    }
    invite.value = fetched.invite
    inviteError.value = ''
    return
  }
  inviteError.value = joined.message || fetched.message
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

watch(query, (value) => {
  if (skipNextSearch) {
    skipNextSearch = false
    return
  }
  scheduleSearch(value)
})

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
  try {
    pokedex.value = await loadPokedexIndex()
    indexReady.value = true
    fillFrenchNames()
  } catch {
    detailsError.value = 'Impossible de charger le Pokédex (PokéAPI).'
    return
  }

  await restoreInviteFromQuery()
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
      <InviteFriendMenu
        :game-id="STARTER_GAME_ID"
        :invite="invite"
        :extra="inviteExtra"
        @invite-created="onInviteCreated"
        @invite-updated="onInviteUpdated"
      />
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

    <StarterDraw
      v-if="showDraw"
      :pokemon="myProposals"
      :friend-name="friendName"
      :round="gameState.round"
      :picked-id="myPick"
      :waiting="Boolean(myPick) && !theirPick"
      :disabled="savingPick"
      @pick="pickForFriend"
    />
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

    <section class="dex" aria-labelledby="dex-title">
      <h3 id="dex-title">Pokédex</h3>
      <p class="dex-desc">
        Recherche n’importe quel Pokémon par nom français, nom anglais ou numéro.
      </p>

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

.search button {
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0 1rem;
  background: var(--teal);
  color: var(--cream);
  font-weight: 700;
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
