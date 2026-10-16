import { MAX_POKEAPI_PARALLEL } from './config.js'

export const API = 'https://pokeapi.co/api/v2'

const memory = new Map()
const inflight = new Map()
let running = 0
const waiting = []

function enqueue(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      running += 1
      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      } finally {
        running -= 1
        if (waiting.length) waiting.shift()()
      }
    }
    if (running < MAX_POKEAPI_PARALLEL) run()
    else waiting.push(run)
  })
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('gamecenter-pokeapi', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('json')) {
          request.result.createObjectStore('json')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGet(key) {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('json', 'readonly')
      const req = tx.objectStore('json').get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key, value) {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('json', 'readwrite')
      tx.objectStore('json').put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export function prettySlug(slug) {
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function pickLocalizedName(entries, fallback) {
  const fr = entries?.find((entry) => entry.language?.name === 'fr')
  return fr?.name || prettySlug(fallback)
}

export async function fetchPoke(path) {
  const url = String(path || '').startsWith('http')
    ? path
    : `${API}/${String(path).replace(/^\//, '')}`

  if (memory.has(url)) return memory.get(url)
  if (inflight.has(url)) return inflight.get(url)

  const job = enqueue(async () => {
    if (memory.has(url)) return memory.get(url)
    const cached = await idbGet(url)
    if (cached) {
      memory.set(url, cached)
      return cached
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error(`PokéAPI ${response.status}`)
    const data = await response.json()
    memory.set(url, data)
    await idbSet(url, data)
    return data
  })

  inflight.set(url, job)
  try {
    return await job
  } finally {
    inflight.delete(url)
  }
}

export async function getPokemon(idOrSlug) {
  return fetchPoke(`pokemon/${idOrSlug}`)
}

export async function getSpecies(idOrSlug) {
  return fetchPoke(`pokemon-species/${idOrSlug}`)
}

export async function getEvolutionChainByUrl(url) {
  if (!url) return null
  return fetchPoke(url)
}

export async function getMove(idOrSlug) {
  return fetchPoke(`move/${idOrSlug}`)
}

export async function getType(name) {
  return fetchPoke(`type/${name}`)
}

export async function getAbility(name) {
  return fetchPoke(`ability/${name}`)
}

export async function getItem(name) {
  return fetchPoke(`item/${name}`)
}

export async function getPokemonForm(name) {
  return fetchPoke(`pokemon-form/${name}`)
}

export function clearPokeMemory() {
  memory.clear()
}
