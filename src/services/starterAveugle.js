import { pickRandomStarters } from './pokeapi.js'

export const TOTAL_ROUNDS = 6
export const GAME_DURATION_MS = 90 * 60 * 1000

function emptyPlayer() {
  return {
    playerName: '',
    proposals: [],
    team: [],
  }
}

export function emptyGameState() {
  return {
    round: 1,
    status: 'naming',
    seen: [],
    host: emptyPlayer(),
    guest: emptyPlayer(),
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
    host: { ...emptyPlayer(), ...(raw.host || {}) },
    guest: { ...emptyPlayer(), ...(raw.guest || {}) },
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
  ].map(Number)
}

export function withPlayerName(state, role, name) {
  const next = cloneState(state)
  next[role].playerName = String(name || '').trim()
  if (bothNamed(next) && next.status === 'naming') next.status = 'picking'
  return next
}

export function needsDeal(state) {
  if (!bothNamed(state) || state.status === 'done') return false
  return (state.host.proposals || []).length !== 3 || (state.guest.proposals || []).length !== 3
}

export function dealRound(state, index) {
  const next = cloneState(state)
  next.status = 'picking'
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

  if (next.round >= TOTAL_ROUNDS) {
    next.status = 'done'
    return next
  }

  next.round += 1
  return dealRound(next, index)
}

export function playerNameFromState(state, role) {
  return state?.[role]?.playerName?.trim() || ''
}
