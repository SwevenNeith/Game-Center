import {
  COUNTDOWN_MS,
  compactRound,
  emptyStats,
  WHOS_THAT_KIND,
} from './whosThatPokemon.js'

function emptyPlayer() {
  return {
    playerName: '',
    ready: false,
    ...emptyStats(),
    rounds: [],
    finished: false,
  }
}

export function emptyWhosThatState() {
  return {
    kind: WHOS_THAT_KIND,
    status: 'naming',
    durationSeconds: 60,
    samePokemon: true,
    seed: '',
    countdownAt: null,
    startedAt: null,
    endsAt: null,
    matchSaved: false,
    host: emptyPlayer(),
    guest: emptyPlayer(),
  }
}

export function cloneWhosThatState(state) {
  return JSON.parse(JSON.stringify(state || emptyWhosThatState()))
}

export function parseWhosThatState(invite) {
  const raw = invite?.game_state
  const base = emptyWhosThatState()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    status: raw.status || base.status,
    durationSeconds: Number(raw.durationSeconds) > 0 ? Number(raw.durationSeconds) : 60,
    samePokemon: raw.samePokemon !== false,
    seed: raw.seed || '',
    countdownAt: raw.countdownAt || null,
    startedAt: raw.startedAt || null,
    endsAt: raw.endsAt || null,
    matchSaved: Boolean(raw.matchSaved),
    host: { ...emptyPlayer(), ...(raw.host || {}) },
    guest: { ...emptyPlayer(), ...(raw.guest || {}) },
  }
}

export function isWhosThatEnded(state) {
  return state?.status === 'ended'
}

export function bothNamed(state) {
  return Boolean(state?.host?.playerName?.trim() && state?.guest?.playerName?.trim())
}

export function bothReady(state) {
  return Boolean(state?.host?.ready && state?.guest?.ready)
}

export function withPlayerName(state, role, name) {
  const next = cloneWhosThatState(state)
  if (!next[role]) return next
  next[role].playerName = String(name || '').trim()
  if (bothNamed(next) && next.status === 'naming') next.status = 'lobby'
  return next
}

export function withDuration(state, seconds) {
  const next = cloneWhosThatState(state)
  if (next.status !== 'naming' && next.status !== 'lobby') return next
  next.durationSeconds = Number(seconds) || 60
  next.host.ready = false
  next.guest.ready = false
  return next
}

export function withSamePokemon(state, enabled) {
  const next = cloneWhosThatState(state)
  if (next.status !== 'naming' && next.status !== 'lobby') return next
  next.samePokemon = Boolean(enabled)
  next.host.ready = false
  next.guest.ready = false
  return next
}

export function withReady(state, role, ready) {
  const next = cloneWhosThatState(state)
  if (next.status !== 'lobby' || !next[role]) return next
  next[role].ready = Boolean(ready)
  return next
}

export function beginCountdown(state, now = Date.now()) {
  const next = cloneWhosThatState(state)
  if (next.status !== 'lobby' || !bothReady(next) || !bothNamed(next)) return next
  next.status = 'countdown'
  next.countdownAt = new Date(now).toISOString()
  next.seed = next.seed || crypto.randomUUID()
  return next
}

export function countdownLeft(state, now = Date.now()) {
  if (state?.status !== 'countdown' || !state.countdownAt) return 0
  const elapsed = now - new Date(state.countdownAt).getTime()
  return Math.max(0, COUNTDOWN_MS - elapsed)
}

export function countdownDigit(state, now = Date.now()) {
  const left = countdownLeft(state, now)
  if (left <= 0) return 0
  return Math.max(1, Math.ceil(left / 1000))
}

export function beginPlaying(state, now = Date.now()) {
  const next = cloneWhosThatState(state)
  if (next.status !== 'countdown') return next
  const start = now
  next.status = 'playing'
  next.startedAt = new Date(start).toISOString()
  next.endsAt = new Date(start + next.durationSeconds * 1000).toISOString()
  next.host.ready = true
  next.guest.ready = true
  return next
}

export function remainingMsFromState(state, now = Date.now()) {
  if (!state?.endsAt) return 0
  return Math.max(0, new Date(state.endsAt).getTime() - now)
}

export function recordPlayerRound(state, role, round, stats) {
  const next = cloneWhosThatState(state)
  if (!next[role]) return next
  next[role].rounds = [...(next[role].rounds || []), compactRound({ id: round.id, name: round.name, artworkUrl: round.artworkUrl }, round)]
  next[role].points = stats?.points ?? next[role].points
  next[role].correct = stats?.correct ?? next[role].correct
  next[role].wrong = stats?.wrong ?? next[role].wrong
  return next
}

export function markPlayerFinished(state, role) {
  const next = cloneWhosThatState(state)
  if (!next[role] || next.status === 'ended') return next
  next[role].finished = true
  if (next.host.finished && next.guest.finished && next.status === 'playing') {
    next.status = 'done'
  }
  return next
}

export function finishWhosThatState(state) {
  const next = cloneWhosThatState(state)
  next.status = 'done'
  next.host.finished = true
  next.guest.finished = true
  return next
}

export function markMatchSaved(state) {
  const next = cloneWhosThatState(state)
  next.matchSaved = true
  return next
}

export function restartWhosThatState(state) {
  const next = emptyWhosThatState()
  next.status = 'lobby'
  next.durationSeconds = state?.durationSeconds || 60
  next.samePokemon = state?.samePokemon !== false
  next.host.playerName = state?.host?.playerName || ''
  next.guest.playerName = state?.guest?.playerName || ''
  return next
}

export function endWhosThatState(state) {
  const next = cloneWhosThatState(state)
  next.status = 'ended'
  next.host.ready = false
  next.guest.ready = false
  return next
}
