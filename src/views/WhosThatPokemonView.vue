<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InviteFriendMenu from '../components/InviteFriendMenu.vue'
import WhosThatHistoryMenu from '../components/WhosThatHistoryMenu.vue'
import WhosThatRecap from '../components/WhosThatRecap.vue'
import WhosThatSilhouette from '../components/WhosThatSilhouette.vue'
import { getLocalDeviceName } from '../services/device.js'
import {
  fetchActiveInviteForDevice,
  fetchInviteByCode,
  fetchInviteById,
  forgetGameSession,
  isInviteExpired,
  joinInvite,
  localPlayerName,
  localPlayerRole,
  otherPlayerName,
  purgeExpiredInvites,
  rememberGameSession,
  saveWhosThatMatch,
  updateInvite,
  WHOS_THAT_GAME_ID,
} from '../services/invites.js'
import {
  beginCountdown,
  beginPlaying,
  bothNamed,
  bothReady,
  countdownDigit,
  countdownLeft,
  emptyWhosThatState,
  markMatchSaved,
  markPlayerFinished,
  parseWhosThatState,
  recordPlayerRound,
  remainingMsFromState,
  restartWhosThatState,
  withDuration,
  withPlayerName,
  withReady,
  withSamePokemon,
} from '../services/whosThatGame.js'
import {
  applyAnswer,
  buildMatchResults,
  buildSoloResults,
  compactRound,
  createMysterySession,
  DURATION_OPTIONS,
  fetchMysteryById,
  formatClock,
  frozenRemaining,
  isCorrectGuess,
  shiftedDeadline,
  pokemonIdAt,
  REVEAL_HOLD_MS,
} from '../services/whosThatPokemon.js'

const route = useRoute()
const router = useRouter()

const invite = ref(null)
const inviteError = ref('')
const endedNotice = ref('')
const nameDraft = ref('')
const enteredName = ref('')
const savingName = ref(false)
const savingReady = ref(false)

const phase = ref('lobby')
const durationSeconds = ref(60)
const samePokemon = ref(true)
const remainingMs = ref(0)
const countdownValue = ref(0)
const stats = ref({ points: 0, correct: 0, wrong: 0 })
const rounds = ref([])
const recap = ref(null)
const pokemon = ref(null)
const revealed = ref(false)
const lastCorrect = ref(null)
const guess = ref('')
const loading = ref(false)
const error = ref('')
const saveError = ref('')
const saving = ref(false)
const confirmAction = ref(null)

const gameState = computed(() => parseWhosThatState(invite.value))
const myRole = computed(() => localPlayerRole(invite.value))
const isHost = computed(() => myRole.value === 'host')
const mySavedName = computed(() => localPlayerName(invite.value) || enteredName.value)
const friendName = computed(() => otherPlayerName(invite.value))
const guestJoined = computed(() => Boolean(invite.value?.guest_device_id))
const duoReady = computed(() => Boolean(invite.value && guestJoined.value && bothNamed(gameState.value)))
const waitingForFriend = computed(
  () => Boolean(invite.value && !guestJoined.value && !isInviteExpired(invite.value)),
)
const artworkUrl = computed(() => pokemon.value?.artworkUrl || '')
const clock = computed(() => formatClock(remainingMs.value))
const urgent = computed(() => remainingMs.value > 0 && remainingMs.value <= 10_000)
const canSubmit = computed(
  () =>
    phase.value === 'playing' &&
    Boolean(pokemon.value) &&
    !loading.value &&
    !error.value &&
    !revealed.value &&
    guess.value.trim().length > 0,
)
const canSkip = computed(
  () =>
    phase.value === 'playing' &&
    Boolean(pokemon.value) &&
    !loading.value &&
    !error.value &&
    !revealed.value,
)
const iAmReady = computed(() => Boolean(myRole.value && gameState.value[myRole.value]?.ready))
const friendReady = computed(() => {
  if (!myRole.value) return false
  const other = myRole.value === 'host' ? 'guest' : 'host'
  return Boolean(gameState.value[other]?.ready)
})

const inviteExtra = computed(() => {
  const state = emptyWhosThatState()
  state.host.playerName = mySavedName.value
  state.durationSeconds = durationSeconds.value
  state.samePokemon = samePokemon.value
  return {
    host_name: mySavedName.value || 'Hôte',
    game_state: state,
  }
})

let session = createMysterySession()
let playToken = 0
let localCursor = 0
let timerId = 0
let revealTimer = 0
let deadline = 0
let pauseStartedAt = 0
let startedKey = ''
let finishing = false

function bumpPlay() {
  playToken += 1
  window.clearInterval(timerId)
  window.clearTimeout(revealTimer)
  timerId = 0
  revealTimer = 0
  pauseStartedAt = 0
  finishing = false
  return playToken
}

function pauseClock() {
  if (!pauseStartedAt) pauseStartedAt = Date.now()
  remainingMs.value = frozenRemaining(deadline, Date.now(), pauseStartedAt)
}

function resumeClock() {
  deadline = shiftedDeadline(deadline, pauseStartedAt, Date.now())
  pauseStartedAt = 0
  remainingMs.value = frozenRemaining(deadline, Date.now())
}

function resetBoard() {
  pokemon.value = null
  revealed.value = false
  lastCorrect.value = null
  guess.value = ''
  loading.value = false
  error.value = ''
  stats.value = { points: 0, correct: 0, wrong: 0 }
  rounds.value = []
  remainingMs.value = 0
  saveError.value = ''
  saving.value = false
  recap.value = null
  session = createMysterySession()
  localCursor = 0
}

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
  if (!next || parseWhosThatState(next).status === 'ended') {
    if (invite.value) {
      forgetGameSession(WHOS_THAT_GAME_ID)
      if (!options.silent) {
        endedNotice.value = 'La partie a été terminée. Les deux appareils sont déconnectés.'
      }
    }
    invite.value = null
    syncInviteQuery(null)
    if (phase.value === 'countdown' || phase.value === 'playing' || phase.value === 'done') {
      bumpPlay()
      resetBoard()
      startedKey = ''
      phase.value = 'lobby'
    }
    return
  }

  endedNotice.value = ''
  rememberGameSession(WHOS_THAT_GAME_ID, next)
  invite.value = next
  syncInviteQuery(next)
  const state = parseWhosThatState(next)
  durationSeconds.value = state.durationSeconds
  samePokemon.value = state.samePokemon

  if (state.status === 'countdown') {
    phase.value = 'countdown'
    countdownValue.value = countdownDigit(state)
    startTimer()
  } else if (state.status === 'playing') {
    if (phase.value === 'done') {
      recap.value = recapPayload(state)
    } else {
      const key = `${next.id}:${state.startedAt}`
      if (startedKey !== key) startFromInvite(state, key)
    }
  } else if (state.status === 'done') {
    showInviteRecap(state)
  } else if (state.status === 'lobby' || state.status === 'naming') {
    if (phase.value === 'playing' || phase.value === 'countdown' || phase.value === 'done') {
      bumpPlay()
      resetBoard()
      startedKey = ''
    }
    phase.value = 'lobby'
  }

  if (!options.skipAdvance) maybeAdvance(next)
}

async function latestInvite(fallback) {
  if (!fallback?.id) return fallback
  const latest = await fetchInviteById(fallback.id)
  return latest.success ? latest.invite : fallback
}

async function patchState(mutator) {
  if (!invite.value?.id) return { success: false, message: 'Aucune partie.' }
  const current = await latestInvite(invite.value)
  const next = mutator(parseWhosThatState(current))
  const result = await updateInvite(current.id, { game_state: next })
  if (result.success) applyInvite(result.invite, { skipAdvance: true })
  else inviteError.value = result.message
  return result
}

async function maybeAdvance(nextInvite = invite.value) {
  if (!nextInvite) return
  const current = await latestInvite(nextInvite)
  const role = localPlayerRole(current)
  const state = parseWhosThatState(current)
  if (state.status === 'naming' && bothNamed(state) && role === 'host') {
    const result = await updateInvite(current.id, { game_state: { ...state, status: 'lobby' } })
    if (result.success) applyInvite(result.invite, { skipAdvance: true })
    return
  }
  if (state.status === 'lobby' && bothReady(state) && bothNamed(state) && role === 'host') {
    const result = await updateInvite(current.id, { game_state: beginCountdown(state) })
    if (result.success) applyInvite(result.invite, { skipAdvance: true })
    return
  }
  if (state.status === 'countdown' && countdownLeft(state) <= 0) {
    const result = await updateInvite(current.id, { game_state: beginPlaying(state) })
    if (result.success) applyInvite(result.invite)
  }
}

function goLobby() {
  bumpPlay()
  resetBoard()
  confirmAction.value = null
  startedKey = ''
  phase.value = 'lobby'
}

function tick() {
  if (invite.value) {
    const state = parseWhosThatState(invite.value)
    if (state.status === 'countdown') {
      countdownValue.value = countdownDigit(state)
      remainingMs.value = 0
      if (countdownLeft(state) <= 0) maybeAdvance(invite.value)
      return
    }
  }
  remainingMs.value = frozenRemaining(deadline, Date.now(), pauseStartedAt)
  if (pauseStartedAt || remainingMs.value > 0) return
  window.clearInterval(timerId)
  timerId = 0
  finishMatch(playToken)
}

function startTimer(seconds) {
  if (seconds) deadline = Date.now() + Number(seconds) * 1000
  pauseStartedAt = 0
  window.clearInterval(timerId)
  timerId = window.setInterval(tick, 200)
  tick()
}

async function focusGuess() {
  await nextTick()
  document.getElementById('whos-guess')?.focus()
}

async function loadRound(token) {
  revealed.value = false
  lastCorrect.value = null
  guess.value = ''
  loading.value = true
  error.value = ''
  try {
    const state = invite.value ? parseWhosThatState(invite.value) : null
    let entry = null
    if (state?.samePokemon && state.seed) {
      const id = pokemonIdAt(state.seed, localCursor)
      entry = await fetchMysteryById(id)
      const nextId = pokemonIdAt(state.seed, localCursor + 1)
      if (nextId) fetchMysteryById(nextId).catch(() => {})
    } else {
      entry = await session.draw()
    }
    if (token !== playToken) return
    pokemon.value = entry
  } catch (err) {
    if (token !== playToken) return
    pokemon.value = null
    error.value = err.message || 'Impossible de charger un Pokémon.'
  } finally {
    if (token === playToken) loading.value = false
  }
  if (token === playToken && !error.value) await focusGuess()
}

function startFromInvite(state, key) {
  startedKey = key
  const token = bumpPlay()
  resetBoard()
  localCursor = myRole.value ? state[myRole.value]?.rounds?.length || 0 : 0
  stats.value = {
    points: myRole.value ? state[myRole.value]?.points || 0 : 0,
    correct: myRole.value ? state[myRole.value]?.correct || 0 : 0,
    wrong: myRole.value ? state[myRole.value]?.wrong || 0 : 0,
  }
  rounds.value = myRole.value ? [...(state[myRole.value]?.rounds || [])] : []
  session = createMysterySession()
  phase.value = 'playing'
  deadline = Date.now() + remainingMsFromState(state)
  startTimer()
  loadRound(token)
}

async function startMatch() {
  if (invite.value) return
  endedNotice.value = ''
  inviteError.value = ''
  const token = bumpPlay()
  resetBoard()
  startedKey = ''
  phase.value = 'playing'
  startTimer(durationSeconds.value)
  await loadRound(token)
}

async function submitGuess() {
  if (!canSubmit.value) return
  const current = pokemon.value
  const typed = guess.value
  const ok = isCorrectGuess(typed, current)
  await resolveRound({ guess: typed, ok, skipped: false })
}

async function skipPokemon() {
  if (!canSkip.value) return
  await resolveRound({ guess: '', ok: false, skipped: true })
}

async function resolveRound({ guess: typed, ok, skipped }) {
  const token = playToken
  const current = pokemon.value
  if (!current) return
  stats.value = applyAnswer(stats.value, ok)
  const round = compactRound(current, { guess: typed, ok, skipped })
  rounds.value = [...rounds.value, round]
  localCursor += 1
  lastCorrect.value = skipped ? false : ok
  revealed.value = true
  pauseClock()
  if (invite.value && myRole.value) {
    await patchState((state) => recordPlayerRound(state, myRole.value, round, stats.value))
  }
  window.clearTimeout(revealTimer)
  revealTimer = window.setTimeout(() => {
    if (token !== playToken) return
    resumeClock()
    if (remainingMs.value <= 0) {
      finishMatch(token)
      return
    }
    loadRound(token)
  }, REVEAL_HOLD_MS)
}

function recapPayload(state) {
  return {
    hostName: state.host.playerName || invite.value?.host_name || 'Hôte',
    guestName: state.guest.playerName || invite.value?.guest_name || 'Adversaire',
    durationSeconds: state.durationSeconds,
    samePokemon: state.samePokemon,
    host: state.host,
    guest: state.guest,
    winner: buildMatchResults({
      durationSeconds: state.durationSeconds,
      samePokemon: state.samePokemon,
      host: state.host,
      guest: state.guest,
    }).winner,
  }
}

function showInviteRecap(state) {
  bumpPlay()
  phase.value = 'done'
  recap.value = recapPayload(state)
  remainingMs.value = 0
}

async function persistDuoResults(currentInvite) {
  const state = parseWhosThatState(currentInvite)
  if (state.matchSaved) return
  saving.value = true
  saveError.value = ''
  const results = buildMatchResults({
    durationSeconds: state.durationSeconds,
    samePokemon: state.samePokemon,
    host: state.host,
    guest: state.guest,
  })
  const saved = await saveWhosThatMatch({
    hostName: state.host.playerName || currentInvite.host_name,
    guestName: state.guest.playerName || currentInvite.guest_name,
    results,
    inviteId: currentInvite.id,
  })
  saving.value = false
  if (!saved.success) {
    saveError.value = saved.message
    return
  }
  await patchState(markMatchSaved)
}

async function finishMatch(token) {
  if (token !== playToken || finishing) return
  if (phase.value === 'lobby' || phase.value === 'countdown') return
  if (!invite.value && phase.value === 'done') return
  finishing = true
  window.clearInterval(timerId)
  window.clearTimeout(revealTimer)
  timerId = 0
  revealTimer = 0
  pauseStartedAt = 0
  remainingMs.value = 0
  if (invite.value && myRole.value) {
    const current = parseWhosThatState(invite.value)
    if (current.status !== 'done' && current.status !== 'ended' && !current[myRole.value]?.finished) {
      await patchState((state) => markPlayerFinished(state, myRole.value))
    }
    const state = parseWhosThatState(invite.value)
    if (phase.value !== 'done') showInviteRecap(state)
    else recap.value = recapPayload(state)
    if (state.status === 'done' && !state.matchSaved) await persistDuoResults(invite.value)
    return
  }
  if (phase.value === 'done') return
  phase.value = 'done'
  recap.value = {
    hostName: getLocalDeviceName(),
    guestName: '',
    durationSeconds: durationSeconds.value,
    samePokemon: true,
    host: { ...stats.value, rounds: rounds.value },
    guest: { points: 0, correct: 0, wrong: 0, pending: true, rounds: [] },
    winner: 'solo',
  }
  saving.value = true
  saveError.value = ''
  const results = buildSoloResults({
    durationSeconds: durationSeconds.value,
    stats: stats.value,
    rounds: rounds.value,
  })
  const saved = await saveWhosThatMatch({
    hostName: getLocalDeviceName(),
    results,
  })
  if (token !== playToken) return
  saving.value = false
  if (!saved.success) saveError.value = saved.message
}

async function chooseDuration(seconds) {
  durationSeconds.value = seconds
  if (!invite.value || !isHost.value) return
  await patchState((state) => withDuration(state, seconds))
}

async function toggleSamePokemon(enabled) {
  samePokemon.value = enabled
  if (!invite.value || !isHost.value) return
  await patchState((state) => withSamePokemon(state, enabled))
}

async function toggleReady() {
  if (!duoReady.value || !myRole.value || savingReady.value) return
  savingReady.value = true
  await patchState((state) => withReady(state, myRole.value, !state[myRole.value]?.ready))
  savingReady.value = false
  await maybeAdvance(invite.value)
}

async function submitName() {
  const name = nameDraft.value.trim()
  if (!name || !invite.value || !myRole.value) return
  enteredName.value = name
  savingName.value = true
  const field = myRole.value === 'host' ? 'host_name' : 'guest_name'
  const result = await updateInvite(invite.value.id, {
    [field]: name,
    game_state: withPlayerName(parseWhosThatState(invite.value), myRole.value, name),
  })
  savingName.value = false
  if (!result.success) {
    inviteError.value = result.message
    return
  }
  applyInvite(result.invite)
}

function askLeave(kind) {
  if (phase.value !== 'playing' && phase.value !== 'countdown') return
  confirmAction.value = kind
}

async function confirmLeave() {
  const kind = confirmAction.value
  confirmAction.value = null
  if (invite.value) {
    await patchState(restartWhosThatState)
    goLobby()
    return
  }
  goLobby()
  if (kind) return
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
    const joined = await joinInvite(String(route.query.code), WHOS_THAT_GAME_ID)
    if (joined.success) {
      applyInvite(joined.invite, { skipAdvance: true })
      inviteError.value = ''
      await maybeAdvance(joined.invite)
      return
    }
    const fetched = await fetchInviteByCode(String(route.query.code))
    if (fetched.success) {
      if (fetched.invite.game_id !== WHOS_THAT_GAME_ID) {
        inviteError.value = 'Ce code n’est valable que pour un autre jeu.'
        return
      }
      applyInvite(fetched.invite, { skipAdvance: true })
      inviteError.value = ''
      return
    }
  }

  const active = await fetchActiveInviteForDevice(WHOS_THAT_GAME_ID)
  if (active.success && active.invite) {
    applyInvite(active.invite, { skipAdvance: true })
    inviteError.value = ''
    await maybeAdvance(active.invite)
    return
  }

  if (route.query.code) {
    inviteError.value = 'Cette partie n’est plus disponible. Tu peux en lancer une nouvelle.'
  }
}

onMounted(async () => {
  await purgeExpiredInvites()
  if (localPlayerName(invite.value)) {
    enteredName.value = localPlayerName(invite.value)
    nameDraft.value = enteredName.value
  }
  await restoreSession()
  if (localPlayerName(invite.value)) {
    enteredName.value = localPlayerName(invite.value)
    nameDraft.value = enteredName.value
  }
})

onUnmounted(() => {
  bumpPlay()
})
</script>

<template>
  <div class="game-page">
    <header class="game-bar">
      <div class="game-logo" aria-hidden="true"></div>
      <div class="game-bar__titles">
        <p class="eyebrow">Jeu</p>
        <h2>Who’s that Pokémon ?</h2>
      </div>
      <div class="game-bar__actions">
        <WhosThatHistoryMenu />
        <InviteFriendMenu
          :game-id="WHOS_THAT_GAME_ID"
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
    <p v-else-if="waitingForFriend" class="friend-banner">
      En attente d’un ami · code {{ invite.code }}
    </p>
    <p v-else-if="inviteError" class="friend-banner friend-banner--error">{{ inviteError }}</p>
    <p v-if="endedNotice" class="friend-banner">{{ endedNotice }}</p>

    <section v-if="invite && !mySavedName" class="card" aria-labelledby="name-title">
      <h3 id="name-title">Ton nom</h3>
      <p class="card-desc">Il s’affichera chez ton ami comme joueur connecté.</p>
      <form class="guess" @submit.prevent="submitName">
        <label class="sr-only" for="player-name">Ton nom</label>
        <input
          id="player-name"
          v-model="nameDraft"
          type="text"
          maxlength="24"
          autocomplete="nickname"
          placeholder="Ex. Léa"
        />
        <button type="submit" class="primary-btn" :disabled="savingName || nameDraft.trim().length < 2">
          {{ savingName ? 'Enregistrement…' : 'Valider' }}
        </button>
      </form>
    </section>

    <section v-else-if="phase === 'lobby'" class="card" aria-labelledby="time-title">
      <h3 id="time-title">Temps de la partie</h3>
      <p class="card-desc">
        {{
          isHost || !invite
            ? 'Devine autant de Pokémon que possible avant la fin du chrono.'
            : 'L’hôte choisit le temps. Tu vois ses choix en direct.'
        }}
      </p>
      <div class="durations" role="radiogroup" aria-labelledby="time-title">
        <button
          v-for="option in DURATION_OPTIONS"
          :key="option.seconds"
          type="button"
          class="duration"
          :class="{ 'duration--on': durationSeconds === option.seconds }"
          role="radio"
          :aria-checked="durationSeconds === option.seconds"
          :disabled="Boolean(invite) && !isHost"
          @click="chooseDuration(option.seconds)"
        >
          {{ option.label }}
        </button>
      </div>

      <label class="same-opt" :class="{ 'is-on': samePokemon, 'is-locked': Boolean(invite) && !isHost }">
        <input
          type="checkbox"
          :checked="samePokemon"
          :disabled="Boolean(invite) && !isHost"
          @change="toggleSamePokemon($event.target.checked)"
        />
        <span>Même Pokémon</span>
      </label>
      <p class="card-desc">
        {{
          samePokemon
            ? 'Les deux joueurs devront deviner les mêmes silhouettes, chacun à son rythme.'
            : 'Chaque joueur aura sa propre série de Pokémon.'
        }}
      </p>

      <button v-if="!invite" type="button" class="primary-btn" @click="startMatch">
        Lancer la partie
      </button>
      <button
        v-else-if="duoReady"
        type="button"
        class="primary-btn"
        :class="{ 'primary-btn--wait': iAmReady }"
        :disabled="savingReady"
        @click="toggleReady"
      >
        {{ iAmReady ? 'Pas prêt' : 'Prêt' }}
      </button>
      <p v-else-if="waitingForFriend" class="hint">En attente d’un ami pour lancer le face-à-face.</p>
      <p v-else-if="invite && !friendName" class="hint">En attente du nom de ton ami.</p>
      <p v-if="duoReady && iAmReady && !friendReady" class="hint">En attente de {{ friendName }}…</p>
      <p v-else-if="duoReady && friendReady && !iAmReady" class="hint">{{ friendName }} est prêt.</p>
    </section>

    <section v-else-if="phase === 'countdown'" class="card countdown" aria-live="assertive">
      <p class="eyebrow">Ça commence</p>
      <p class="countdown__digit">{{ countdownValue || '…' }}</p>
      <p class="card-desc">Les deux joueurs sont prêts.</p>
    </section>

    <template v-else-if="phase === 'playing'">
      <div class="hud" :class="{ 'hud--urgent': urgent }">
        <p>
          <span class="hud-label">Temps</span>
          <strong>{{ clock }}</strong>
        </p>
        <p>
          <span class="hud-label">Score</span>
          <strong>{{ stats.points }}</strong>
        </p>
      </div>

      <div class="match-tools">
        <button type="button" class="tool-btn" @click="askLeave('restart')">Recommencer la partie</button>
        <button type="button" class="tool-btn tool-btn--danger" @click="askLeave('stop')">
          Arrêter la partie
        </button>
      </div>

      <section class="board" aria-labelledby="mystery-title">
        <h3 id="mystery-title" class="sr-only">Pokémon mystère</h3>
        <WhosThatSilhouette
          :artwork-url="artworkUrl"
          :revealed="revealed"
          :loading="loading"
          :error="error"
        />
        <p v-if="revealed && pokemon" class="reveal-name" :class="lastCorrect ? 'reveal-name--ok' : 'reveal-name--ko'">
          {{ pokemon.name }}
        </p>
        <form class="guess" @submit.prevent="submitGuess">
          <label class="sr-only" for="whos-guess">Nom du Pokémon</label>
          <input
            id="whos-guess"
            v-model="guess"
            type="text"
            name="guess"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="Nom du Pokémon"
            :disabled="loading || revealed || Boolean(error)"
          />
          <button type="submit" class="primary-btn" :disabled="!canSubmit">Valider</button>
        </form>
        <button type="button" class="ghost-btn" :disabled="!canSkip" @click="skipPokemon">Passer</button>
      </section>
    </template>

    <template v-else-if="phase === 'done' && recap">
      <WhosThatRecap
        :host-name="recap.hostName"
        :guest-name="recap.guestName"
        :duration-seconds="recap.durationSeconds"
        :same-pokemon="recap.samePokemon"
        :host="recap.host"
        :guest="recap.guest"
        :winner="recap.winner"
      />
      <p v-if="saving" class="hint">Enregistrement de la partie…</p>
      <p v-else-if="saveError" class="hint hint--error">{{ saveError }}</p>
      <button type="button" class="primary-btn" @click="invite ? patchState(restartWhosThatState) : goLobby()">
        Nouvelle partie
      </button>
    </template>

    <Teleport to="body">
      <div
        v-if="confirmAction"
        class="confirm-sheet"
        role="presentation"
        @click.self="confirmAction = null"
      >
        <div
          class="confirm-sheet__box"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="confirmAction === 'restart' ? 'restart-title' : 'stop-title'"
        >
          <h4 :id="confirmAction === 'restart' ? 'restart-title' : 'stop-title'">
            {{ confirmAction === 'restart' ? 'Recommencer la partie ?' : 'Arrêter la partie ?' }}
          </h4>
          <p>La partie en cours ne sera pas enregistrée. Tu reviendras au choix du temps.</p>
          <div class="confirm-sheet__actions">
            <button type="button" class="primary-btn" @click="confirmLeave">
              {{ confirmAction === 'restart' ? 'Oui, recommencer' : 'Oui, arrêter' }}
            </button>
            <button type="button" class="tool-btn" @click="confirmAction = null">Annuler</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.game-page {
  --game-accent: var(--teal);
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

h3 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.game-logo {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--surface-muted);
  border: 1px dashed var(--border);
}

.card,
.board {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
}

.card-desc,
.hint {
  margin: 0.35rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.hint--error {
  color: #8a3d32;
  font-weight: 600;
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

.durations {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.duration {
  min-height: 48px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--ink);
  font-weight: 700;
}

.duration--on {
  background: color-mix(in srgb, var(--teal) 16%, white);
  border-color: color-mix(in srgb, var(--teal) 45%, var(--taupe));
  color: var(--teal);
}

.duration:disabled {
  cursor: default;
}

.same-opt {
  margin-top: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 42px;
  padding: 0.35rem 0.6rem;
  border-radius: 12px;
  background: var(--surface-muted);
  font-size: 0.92rem;
  font-weight: 700;
}

.same-opt.is-on {
  background: color-mix(in srgb, var(--teal) 14%, var(--surface));
}

.same-opt.is-locked {
  cursor: default;
}

.same-opt input {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--teal);
}

.primary-btn,
.ghost-btn {
  width: 100%;
  margin-top: 1rem;
  min-height: 44px;
  border: none;
  border-radius: 12px;
  padding: 0.7rem 1.1rem;
  font-weight: 700;
}

.primary-btn {
  background: var(--teal);
  color: var(--cream);
}

.primary-btn--wait {
  background: var(--surface-muted);
  color: var(--ink);
  border: 1px solid var(--border);
}

.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.45;
}

.ghost-btn {
  background: var(--surface-muted);
  color: var(--ink);
  border: 1px solid var(--border);
}

.countdown {
  text-align: center;
  padding: 2rem 1rem;
}

.countdown__digit {
  margin: 0.4rem 0 0;
  font-family: var(--display);
  font-size: clamp(4.5rem, 18vw, 7rem);
  font-weight: 700;
  line-height: 1;
  color: var(--teal);
}

.hud {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.hud p {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.hud strong {
  font-family: var(--display);
  font-size: 1.45rem;
}

.hud-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--teal);
}

.hud--urgent p:first-child {
  border-color: color-mix(in srgb, #8a3d32 45%, var(--taupe));
}

.hud--urgent p:first-child strong {
  color: #8a3d32;
}

.match-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.tool-btn {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
  box-shadow: var(--shadow);
}

.tool-btn--danger {
  background: color-mix(in srgb, #8a3d32 86%, var(--ink));
  border-color: transparent;
  color: var(--cream);
}

.reveal-name {
  margin: 0.15rem 0 0;
  text-align: center;
  font-family: var(--display);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 600;
}

.reveal-name--ok {
  color: var(--teal);
}

.reveal-name--ko {
  color: #8a3d32;
}

.guess {
  display: flex;
  gap: 0.55rem;
  margin-top: 1rem;
}

.guess input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  background: var(--cream);
  font-size: 16px;
}

.guess .primary-btn {
  width: auto;
  margin-top: 0;
  flex-shrink: 0;
}

.confirm-sheet {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 1.1rem;
  background: color-mix(in srgb, var(--ink) 52%, transparent);
}

.confirm-sheet__box {
  width: min(26rem, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.2rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
  text-align: center;
}

.confirm-sheet__box h4 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.confirm-sheet__box p {
  margin: 0.55rem 0 0;
  color: var(--text-soft);
}

.confirm-sheet__actions {
  margin-top: 0.95rem;
  display: grid;
  gap: 0.5rem;
}

.confirm-sheet__actions .primary-btn {
  margin-top: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .game-logo {
    width: 40px;
    height: 40px;
  }

  .guess {
    flex-direction: column;
  }

  .guess .primary-btn,
  .primary-btn,
  .ghost-btn,
  .tool-btn,
  .duration {
    min-height: 48px;
  }

  .match-tools {
    grid-template-columns: 1fr;
  }
}
</style>
