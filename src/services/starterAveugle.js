import { pickRandomStarters } from './pokeapi.js'

export const TOTAL_ROUNDS = 6
export const GAME_DURATION_MS = 90 * 60 * 1000

export const INFO_FIELDS = [
  { id: 'number', label: 'Numéro' },
  { id: 'englishName', label: 'Nom anglais' },
  { id: 'cry', label: 'Cri' },
  { id: 'genus', label: 'Catégorie' },
  { id: 'types', label: 'Types' },
  { id: 'evolutionStatus', label: 'Statut d’évolution' },
  { id: 'size', label: 'Taille et poids' },
  { id: 'abilities', label: 'Talents' },
  { id: 'stats', label: 'Statistiques de base' },
  { id: 'generation', label: 'Génération' },
  { id: 'habitat', label: 'Habitat' },
  { id: 'color', label: 'Couleur' },
  { id: 'eggGroups', label: 'Groupes d’œuf' },
  { id: 'flavors', label: 'Descriptions du Pokédex' },
  { id: 'moves', label: 'Capacités par niveau' },
]

export function defaultInfoFlags() {
  return Object.fromEntries(INFO_FIELDS.map((field) => [field.id, false]))
}

function emptyPlayer() {
  return {
    playerName: '',
    proposals: [],
    team: [],
    lieId: null,
    lieUnderId: null,
    finalTeam: [],
    sets: [],
  }
}

export function emptyBattle() {
  return {
    seed: null,
    status: '',
    played: 0,
    hostWins: 0,
    guestWins: 0,
    ties: 0,
    avgTurns: 0,
    interval: null,
    verdict: '',
    hostWinRate: 0,
    guestWinRate: 0,
    hostStats: [],
    guestStats: [],
    hostMvp: null,
    guestMvp: null,
    recaps: null,
    error: '',
    progress: 0,
    minBattles: 40,
    maxBattles: 300,
  }
}

export function emptyGameState() {
  return {
    round: 1,
    status: 'naming',
    seen: [],
    infoFlags: defaultInfoFlags(),
    matchSaved: false,
    host: emptyPlayer(),
    guest: emptyPlayer(),
    battle: emptyBattle(),
  }
}

export function parseGameState(invite) {
  const raw = invite?.game_state
  const base = emptyGameState()
  if (!raw || typeof raw !== 'object') return base
  return {
    round: Number(raw.round) > 0 ? Number(raw.round) : 1,
    status: raw.status || 'naming',
    seen: Array.isArray(raw.seen) ? raw.seen.map(Number) : [],
    infoFlags: { ...defaultInfoFlags(), ...(raw.infoFlags || {}) },
    matchSaved: Boolean(raw.matchSaved),
    host: { ...emptyPlayer(), ...(raw.host || {}) },
    guest: { ...emptyPlayer(), ...(raw.guest || {}) },
    battle: { ...emptyBattle(), ...(raw.battle || {}) },
  }
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state || emptyGameState()))
}

export function bothNamed(state) {
  return Boolean(state?.host?.playerName?.trim() && state?.guest?.playerName?.trim())
}

export function usedPokemonIds(state) {
  return [
    ...(state?.host?.team || []),
    ...(state?.guest?.team || []),
    ...(state?.host?.proposals || []),
    ...(state?.guest?.proposals || []),
    state?.host?.lieId,
    state?.guest?.lieId,
  ]
    .filter(Boolean)
    .map(Number)
}

export function withLie(state, role, lieId, underId) {
  const next = cloneState(state)
  const proposals = (next[role].proposals || []).map(Number)
  const id = Number(lieId)
  const under = Number(underId)
  if (!id || proposals.includes(id) || !proposals.includes(under)) return next
  next[role].lieId = id
  next[role].lieUnderId = under
  next.seen = [...new Set([...(next.seen || []).map(Number), id])]
  return next
}

export function clearPlayerLie(state, role) {
  const next = cloneState(state)
  if (!next[role]) return next
  next[role].lieId = null
  next[role].lieUnderId = null
  return next
}

export function restartGameState(state) {
  const next = emptyGameState()
  next.status = 'info'
  next.infoFlags = { ...defaultInfoFlags(), ...(state?.infoFlags || {}) }
  next.host.playerName = state?.host?.playerName || ''
  next.guest.playerName = state?.guest?.playerName || ''
  return next
}

export function withPlayerName(state, role, name) {
  const next = cloneState(state)
  next[role].playerName = String(name || '').trim()
  if (bothNamed(next) && next.status === 'naming') next.status = 'info'
  return next
}

export function withInfoFlag(state, fieldId, enabled) {
  const next = cloneState(state)
  next.infoFlags = { ...defaultInfoFlags(), ...(next.infoFlags || {}), [fieldId]: Boolean(enabled) }
  return next
}

export function isInfoPhase(state) {
  return state?.status === 'info'
}

export function isPicking(state) {
  return state?.status === 'picking'
}

export function isEnded(state) {
  return state?.status === 'ended'
}

export function endGameState(state) {
  const next = cloneState(state)
  next.status = 'ended'
  next.host.proposals = []
  next.guest.proposals = []
  return next
}

export function needsDeal(state) {
  if (!isPicking(state)) return false
  return (state.host.proposals || []).length !== 3 || (state.guest.proposals || []).length !== 3
}

function clearLies(next) {
  next.host.lieId = null
  next.host.lieUnderId = null
  next.guest.lieId = null
  next.guest.lieUnderId = null
}

export function dealRound(state, index) {
  const next = cloneState(state)
  next.status = 'picking'
  clearLies(next)
  const exclude = [...usedPokemonIds(next), ...(next.seen || [])]
  const forGuest = pickRandomStarters(index, 3, exclude)
  const forHost = pickRandomStarters(index, 3, [...exclude, ...forGuest.map((item) => item.id)])
  next.host.proposals = forGuest.map((item) => item.id)
  next.guest.proposals = forHost.map((item) => item.id)
  next.seen = [...(next.seen || []), ...next.host.proposals, ...next.guest.proposals]
  return next
}

export function completeRound(state, hostPick, guestPick, index) {
  const next = cloneState(state)
  next.guest.team = [...(next.guest.team || []), Number(hostPick)]
  next.host.team = [...(next.host.team || []), Number(guestPick)]
  next.host.proposals = []
  next.guest.proposals = []
  clearLies(next)

  if (next.round >= TOTAL_ROUNDS) {
    next.status = 'evolve'
    return next
  }

  next.round += 1
  return dealRound(next, index)
}

export function playerNameFromState(state, role) {
  return state?.[role]?.playerName?.trim() || ''
}

export function isTeamsPhase(state) {
  return state?.status === 'teams'
}

export function isEvolve(state) {
  return state?.status === 'evolve'
}

export function startCombatState(state) {
  const next = cloneState(state)
  if (next.status === 'teams') next.status = 'evolve'
  return next
}

export function isPreview(state) {
  return state?.status === 'preview'
}

export function isBattle(state) {
  return state?.status === 'battle'
}

export function teamsComplete(state) {
  return (state?.host?.team || []).length >= TOTAL_ROUNDS && (state?.guest?.team || []).length >= TOTAL_ROUNDS
}

export function finalsReady(player) {
  return (player?.finalTeam || []).filter(Boolean).length >= TOTAL_ROUNDS
}

export function bothFinalsChosen(state) {
  return finalsReady(state?.host) && finalsReady(state?.guest)
}

export function bothSetsReady(state) {
  return (state?.host?.sets || []).length >= TOTAL_ROUNDS && (state?.guest?.sets || []).length >= TOTAL_ROUNDS
}

export function withFinalTeam(state, role, finalTeam) {
  const next = cloneState(state)
  next[role].finalTeam = finalTeam
  return next
}

export function withFinalChoice(state, role, index, choice) {
  const next = cloneState(state)
  const team = Array.from({ length: TOTAL_ROUNDS }, (_, slot) => next[role].finalTeam?.[slot] || null)
  if (team[index]?.pokemonId) return next
  team[index] = choice
  next[role].finalTeam = team
  return next
}

export function withTeamSets(state, hostSets, guestSets) {
  const next = cloneState(state)
  if (hostSets) next.host.sets = hostSets
  if (guestSets) next.guest.sets = guestSets
  if (bothSetsReady(next)) next.status = 'preview'
  return next
}

export function withOneSet(state, role, index, set) {
  const next = cloneState(state)
  const sets = [...(next[role].sets || [])]
  sets[index] = set
  next[role].sets = sets
  return next
}

export function withBattleProgress(state, battle) {
  const next = cloneState(state)
  next.status = 'battle'
  next.battle = { ...emptyBattle(), ...(next.battle || {}), ...battle }
  return next
}

export function withBattleResults(state, results) {
  const next = cloneState(state)
  next.status = 'done'
  next.battle = { ...emptyBattle(), ...(next.battle || {}), ...results, status: 'done' }
  return next
}
