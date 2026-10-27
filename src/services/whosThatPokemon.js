import { isExcludedStarterForm, isParadoxPokemon, PARADOX_SPECIES_IDS } from './pokeapi.js'

const API = 'https://pokeapi.co/api/v2'
const CACHE_KEY = 'gamecenter.whos-that-pokemon-v1'

/** National Dex : formes par défaut uniquement (pas de Méga, régionales, etc.). */
export const MAX_POKEMON_ID = 1025
export const FETCH_ATTEMPTS = 3
export const REVEAL_HOLD_MS = 1000
export const COUNTDOWN_MS = 3000
export const WHOS_THAT_KIND = 'whos-that-pokemon'
export const GUEST_PLACEHOLDER = 'Adversaire'

export const DURATION_OPTIONS = [
  { seconds: 30, label: '30 secondes' },
  { seconds: 60, label: '1 minute' },
  { seconds: 90, label: '1 minute 30' },
  { seconds: 120, label: '2 minutes' },
]

const memoryCache = new Map()

function randomUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

function readPersistedCache() {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePersistedCache(bag) {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(bag))
  } catch {
    /* quota ou localStorage indisponible */
  }
}

export function cacheGet(id) {
  const key = String(id)
  if (memoryCache.has(key)) return memoryCache.get(key)
  const bag = readPersistedCache()
  const entry = bag[key]
  if (entry?.id && entry?.name && entry?.artworkUrl) {
    memoryCache.set(key, entry)
    return entry
  }
  return null
}

export function cacheSet(entry) {
  if (!entry?.id || !entry?.name || !entry?.artworkUrl) return
  const key = String(entry.id)
  memoryCache.set(key, entry)
  const bag = readPersistedCache()
  bag[key] = entry
  writePersistedCache(bag)
}

export function resetMysteryCache() {
  memoryCache.clear()
  try {
    globalThis.localStorage?.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function isExcludedMysteryId(id) {
  return PARADOX_SPECIES_IDS.has(Number(id)) || isParadoxPokemon(id)
}

export function isExcludedMysteryPokemon(pokemon, species) {
  const id = Number(pokemon?.id || species?.id)
  if (isExcludedMysteryId(id)) return true
  if (isExcludedStarterForm(pokemon?.name) || isExcludedStarterForm(pokemon?.species?.name)) return true
  const genera = Array.isArray(species?.genera) ? species.genera : []
  return genera.some((entry) => {
    const genus = String(entry?.genus || '').toLowerCase()
    return genus.includes('paradoxe') || genus.includes('paradox pokemon')
  })
}

export function eligibleMysteryIds(max = MAX_POKEMON_ID) {
  const ids = []
  for (let id = 1; id <= max; id += 1) {
    if (!isExcludedMysteryId(id)) ids.push(id)
  }
  return ids
}

export function pickPokemonId(seen = [], max = MAX_POKEMON_ID) {
  const used = new Set([...seen].map(Number))
  const eligible = eligibleMysteryIds(max)
  const pool = eligible.filter((id) => !used.has(id))
  const source = pool.length ? pool : eligible
  return source[Math.floor(randomUnit() * source.length)]
}

export function hashSeed(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffledDeck(seed, ids) {
  const copy = [...ids]
  const random = mulberry32(hashSeed(seed))
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = copy[i]
    copy[i] = copy[j]
    copy[j] = swap
  }
  return copy
}

export function pokemonIdAt(seed, cursor, ids) {
  const deck = ids?.length ? ids : eligibleMysteryIds()
  const shuffled = shuffledDeck(seed, deck)
  if (!shuffled.length) return null
  const index = ((Number(cursor) || 0) % shuffled.length + shuffled.length) % shuffled.length
  return shuffled[index]
}

export function artworkUrlFromPokemon(data) {
  return (
    data?.sprites?.other?.['official-artwork']?.front_default ||
    data?.sprites?.other?.home?.front_default ||
    ''
  )
}

export function frenchNameFromSpecies(species, fallback = '') {
  const names = Array.isArray(species?.names) ? species.names : []
  const fr = names.find((entry) => entry?.language?.name === 'fr')
  const en = names.find((entry) => entry?.language?.name === 'en')
  return fr?.name || en?.name || fallback || ''
}

export function englishNameFromSpecies(species, fallback = '') {
  const names = Array.isArray(species?.names) ? species.names : []
  const en = names.find((entry) => entry?.language?.name === 'en')
  return en?.name || fallback || ''
}

export function normalizeGuess(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[♀]/g, 'f')
    .replace(/[♂]/g, 'm')
    .replace(/[^a-z0-9]+/g, '')
}

export function isCorrectGuess(guess, pokemon) {
  const needle = normalizeGuess(guess)
  if (!needle || !pokemon) return false
  return [pokemon.name, pokemon.nameEn].some((label) => label && normalizeGuess(label) === needle)
}

export function applyAnswer(stats, ok) {
  const current = stats || { points: 0, correct: 0, wrong: 0 }
  return {
    points: current.points + (ok ? 1 : 0),
    correct: current.correct + (ok ? 1 : 0),
    wrong: current.wrong + (ok ? 0 : 1),
  }
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Temps restant : fige l’horloge si une pause (révélation) est en cours. */
export function frozenRemaining(deadline, now, pauseAt = 0) {
  const clock = pauseAt || now
  return Math.max(0, Number(deadline) - Number(clock))
}

/** Décale la fin de partie de la durée de la pause. */
export function shiftedDeadline(deadline, pauseAt, now) {
  if (!pauseAt) return Number(deadline)
  return Number(deadline) + (Number(now) - Number(pauseAt))
}

export function durationLabel(seconds) {
  const option = DURATION_OPTIONS.find((item) => item.seconds === Number(seconds))
  return option?.label || `${seconds} s`
}

export function emptyStats() {
  return { points: 0, correct: 0, wrong: 0 }
}

export function compactRound(pokemon, { guess = '', ok = false, skipped = false } = {}) {
  return {
    id: Number(pokemon?.id) || 0,
    name: pokemon?.name || '',
    artworkUrl: pokemon?.artworkUrl || '',
    guess: String(guess || '').trim(),
    ok: Boolean(ok),
    skipped: Boolean(skipped),
  }
}

export function matchWinner(host, guest) {
  if (!guest || guest.pending) return 'solo'
  if ((host?.points || 0) > (guest.points || 0)) return 'host'
  if ((guest.points || 0) > (host?.points || 0)) return 'guest'
  return 'tie'
}

export function buildMatchResults({
  durationSeconds,
  samePokemon = true,
  host,
  guest,
  rounds = [],
} = {}) {
  const hostSide = {
    points: host?.points || 0,
    correct: host?.correct || 0,
    wrong: host?.wrong || 0,
    rounds: (host?.rounds || rounds).slice(-80),
  }
  const guestSide = guest?.pending
    ? { ...emptyStats(), pending: true, rounds: [] }
    : {
        points: guest?.points || 0,
        correct: guest?.correct || 0,
        wrong: guest?.wrong || 0,
        pending: false,
        rounds: (guest?.rounds || []).slice(-80),
      }
  return {
    kind: WHOS_THAT_KIND,
    durationSeconds: Number(durationSeconds) || 0,
    samePokemon: Boolean(samePokemon),
    host: hostSide,
    guest: guestSide,
    winner: matchWinner(hostSide, guestSide),
    status: 'done',
    rounds: hostSide.rounds,
    savedAt: new Date().toISOString(),
  }
}

export function buildSoloResults({ durationSeconds, stats, rounds = [] }) {
  return buildMatchResults({
    durationSeconds,
    samePokemon: true,
    host: { ...emptyStats(), ...stats, rounds },
    guest: { ...emptyStats(), pending: true },
  })
}

export function parseWhosThatResults(raw) {
  if (!raw || raw.kind !== WHOS_THAT_KIND) return null
  const host = {
    points: Number(raw.host?.points) || 0,
    correct: Number(raw.host?.correct) || 0,
    wrong: Number(raw.host?.wrong) || 0,
  }
  const guestPending = raw.guest?.pending !== false && (raw.winner === 'solo' || !raw.guest)
  const guest = {
    points: Number(raw.guest?.points) || 0,
    correct: Number(raw.guest?.correct) || 0,
    wrong: Number(raw.guest?.wrong) || 0,
    pending: guestPending,
    rounds: Array.isArray(raw.guest?.rounds) ? raw.guest.rounds : [],
  }
  return {
    kind: WHOS_THAT_KIND,
    durationSeconds: Number(raw.durationSeconds) || 0,
    samePokemon: raw.samePokemon !== false,
    host: { ...host, rounds: Array.isArray(raw.host?.rounds) ? raw.host.rounds : raw.rounds || [] },
    guest,
    winner: raw.winner || 'solo',
    status: raw.status || 'done',
    rounds: Array.isArray(raw.rounds) ? raw.rounds : [],
    savedAt: raw.savedAt || '',
  }
}

function pointsPhrase(value) {
  const pts = Number(value) || 0
  return `${pts} ${pts === 1 ? 'point' : 'points'}`
}

export function winnerLabel(results, hostName, guestName) {
  if (!results) return ''
  if (results.winner === 'solo' || results.guest?.pending) return 'Partie solo'
  if (results.winner === 'host') {
    return results.host?.points == null
      ? `${hostName} l’emporte`
      : `${hostName} l’emporte avec ${pointsPhrase(results.host.points)}`
  }
  if (results.winner === 'guest') {
    return results.guest?.points == null
      ? `${guestName} l’emporte`
      : `${guestName} l’emporte avec ${pointsPhrase(results.guest.points)}`
  }
  if (results.host?.points == null) return 'Égalité'
  return `Égalité · ${pointsPhrase(results.host.points)} partout`
}

export function officialPokemonName(round) {
  const name = String(round?.name || '').trim()
  if (name) return name
  if (round?.ok && round?.guess) return String(round.guess).trim()
  const id = Number(round?.id) || 0
  return id ? `Pokémon n°${id}` : 'Pokémon'
}

export function playerAnswerLabel(round) {
  if (!round) return '—'
  if (round.skipped) return 'Passé'
  if (round.ok) return 'Trouvé'
  const guess = String(round.guess || '').trim()
  return guess || '—'
}

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  let response
  try {
    response = await fetchImpl(url)
  } catch (error) {
    const err = new Error('réseau')
    err.cause = error
    throw err
  }
  if (!response || !response.ok) {
    const status = response?.status || 0
    throw new Error(status === 404 ? 'introuvable' : `http-${status}`)
  }
  return response.json()
}

export async function preloadImage(url) {
  if (!url || typeof Image === 'undefined') return url
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(url)
    img.onerror = () => reject(new Error('Artwork'))
    img.src = url
  })
}

export async function fetchMysteryById(id, fetchImpl = globalThis.fetch) {
  if (isExcludedMysteryId(id)) throw new Error('exclu')

  const cached = cacheGet(id)
  if (cached) {
    if (isExcludedMysteryId(cached.id)) throw new Error('exclu')
    await preloadImage(cached.artworkUrl)
    return cached
  }

  const [pokemon, species] = await Promise.all([
    fetchJson(`${API}/pokemon/${id}`, fetchImpl),
    fetchJson(`${API}/pokemon-species/${id}`, fetchImpl),
  ])

  if (isExcludedMysteryPokemon(pokemon, species)) throw new Error('exclu')

  const artworkUrl = artworkUrlFromPokemon(pokemon)
  if (!artworkUrl) throw new Error('Artwork')

  const name = frenchNameFromSpecies(species, pokemon?.name || '')
  if (!name) throw new Error('introuvable')
  const nameEn = englishNameFromSpecies(species, pokemon?.name || '')

  const entry = { id: Number(pokemon?.id) || Number(id), name, nameEn, artworkUrl }
  cacheSet(entry)
  await preloadImage(entry.artworkUrl)
  return entry
}

export function describeLoadError(error) {
  const message = String(error?.message || '')
  if (message === 'introuvable' || message.includes('404')) {
    return 'Impossible de charger un Pokémon : identifiant introuvable.'
  }
  if (message === 'réseau' || error?.name === 'TypeError') {
    return 'Impossible de charger un Pokémon : réseau indisponible.'
  }
  if (message === 'Artwork') {
    return 'Impossible de charger un Pokémon : aucune image officielle.'
  }
  if (message === 'exclu') {
    return 'Impossible de charger un Pokémon : forme exclue.'
  }
  return 'Impossible de charger un Pokémon. Réessaie dans un instant.'
}

/**
 * Tire un Pokémon parmi 1..max, récupère artwork + nom FR, jusqu’à 3 tentatives.
 * @returns {Promise<{ id: number, name: string, artworkUrl: string }>}
 */
export async function loadMysteryPokemon(options = {}) {
  const {
    seen = [],
    maxId = MAX_POKEMON_ID,
    attempts = FETCH_ATTEMPTS,
    fetchImpl = globalThis.fetch,
    pickId = pickPokemonId,
  } = options

  const used = [...seen]
  let lastError = null

  for (let i = 0; i < attempts; i += 1) {
    const id = pickId(used, maxId)
    used.push(id)
    try {
      return await fetchMysteryById(id, fetchImpl)
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(describeLoadError(lastError))
}

/**
 * Session de tirage : évite les doublons, précharge le Pokémon suivant.
 */
export function createMysterySession(options = {}) {
  const maxId = options.maxId || MAX_POKEMON_ID
  const seen = new Set()
  let preload = null

  function loadFresh() {
    return loadMysteryPokemon({ ...options, seen: [...seen], maxId })
  }

  async function draw() {
    const pending = preload
    preload = null
    let entry = null
    try {
      entry = pending ? await pending : null
    } catch {
      entry = null
    }
    if (!entry) entry = await loadFresh()
    seen.add(entry.id)
    if (seen.size >= maxId) seen.clear()
    preload = loadFresh().catch(() => null)
    return entry
  }

  return {
    draw,
    seenIds: () => [...seen],
  }
}
