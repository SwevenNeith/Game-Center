import {
  BANNED_ABILITY_IDS,
  BANNED_MOVE_IDS,
  BATTLE_LEVEL,
  EV_EACH,
  IV_EACH,
  NEUTRAL_ITEMS,
  SUPPORT_MOVE_IDS,
  SUPPORT_SLOT_CHANCE,
} from './config.js'
import { TYPE_COLORS } from '../pokeapi.js'
import {
  getAbility,
  getItem,
  getMove,
  getPokemon,
  getSpecies,
  pickLocalizedName,
} from './pokeCache.js'
import { baseStatsFromPokemon, pickNature, statsAtLevel } from './stats.js'

let dexApi = null
async function dex() {
  if (!dexApi) dexApi = await import('./showdownIds.js')
  return dexApi
}

const DAMAGE_CLASS_FR = {
  physical: 'Physique',
  special: 'Spécial',
  status: 'Statut',
}

function randomUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

function weightedPick(items, scoreOf, exclude = new Set()) {
  const pool = items.filter((item) => !exclude.has(item.id) && !exclude.has(item.slug))
  if (!pool.length) return null
  const scores = pool.map((item) => Math.max(0.01, scoreOf(item)))
  const total = scores.reduce((sum, value) => sum + value, 0)
  let cursor = randomUnit() * total
  for (let i = 0; i < pool.length; i += 1) {
    cursor -= scores[i]
    if (cursor <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

async function collectLearnset(pokemonIdOrSlug, acc = new Map()) {
  const pokemon = await getPokemon(pokemonIdOrSlug)
  for (const entry of pokemon.moves || []) {
    const slug = entry.move?.name
    if (!slug || acc.has(slug)) continue
    acc.set(slug, entry.move.url)
  }
  const species = await getSpecies(pokemon.species?.name || pokemon.id)
  if (species.evolves_from_species?.name) {
    try {
      await collectLearnset(species.evolves_from_species.name, acc)
    } catch {
      // pré-évolution absente
    }
  }
  return acc
}

async function moveInfo(slug) {
  const { resolveMove } = await dex()
  const data = await getMove(slug)
  const dexMove = resolveMove(slug)
  if (!dexMove.exists || dexMove.isMax || dexMove.isZ) return null
  if (dexMove.ohko || BANNED_MOVE_IDS.has(dexMove.id)) return null
  const classSlug = data.damage_class?.name || dexMove.category?.toLowerCase()
  return {
    id: data.id,
    slug: data.name,
    name: pickLocalizedName(data.names, data.name),
    type: data.type?.name || String(dexMove.type || '').toLowerCase(),
    typeName: pickLocalizedName(data.names, data.type?.name) ? null : null,
    typeLabel: data.type?.name,
    classSlug,
    className: DAMAGE_CLASS_FR[classSlug] || '',
    power: data.power ?? dexMove.basePower ?? null,
    accuracy: data.accuracy ?? dexMove.accuracy ?? null,
    priority: data.priority ?? dexMove.priority ?? 0,
    showdown: dexMove.name,
  }
}

function offensiveScore(move, preferPhysical) {
  if (!move.power || move.classSlug === 'status') return 0
  const accuracy = (move.accuracy || 100) / 100
  const category =
    (preferPhysical && move.classSlug === 'physical') ||
    (!preferPhysical && move.classSlug === 'special')
      ? 1.35
      : 0.65
  return move.power * accuracy * category
}

async function pickAbility(pokemon) {
  const { resolveAbility } = await dex()
  const entries = [...(pokemon.abilities || [])].sort((a, b) => a.slot - b.slot)
  for (const entry of entries) {
    const slug = entry.ability?.name
    if (!slug) continue
    const ability = resolveAbility(slug)
    if (!ability.exists || BANNED_ABILITY_IDS.has(ability.id)) continue
    const data = await getAbility(slug)
    return {
      slug: data.name,
      name: pickLocalizedName(data.names, data.name),
      showdown: ability.name,
    }
  }
  return { slug: 'noability', name: 'Aucun talent', showdown: 'No Ability' }
}

async function pickItem(used = new Set()) {
  const { isKnownItem, resolveItem } = await dex()
  const shuffled = [...NEUTRAL_ITEMS].sort(() => randomUnit() - 0.5)
  const ordered = [
    ...shuffled.filter((slug) => !used.has(slug)),
    ...shuffled.filter((slug) => used.has(slug)),
  ]
  for (const slug of ordered) {
    if (!isKnownItem(slug)) continue
    const data = await getItem(slug)
    const item = resolveItem(slug)
    return {
      slug: data.name,
      name: pickLocalizedName(data.names, data.name),
      sprite: data.sprites?.default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`,
      showdown: item.name,
    }
  }
  return { slug: 'leftovers', name: 'Restes', sprite: '', showdown: 'Leftovers' }
}

function fillMoves(moves, types, preferPhysical, toID) {
  const chosen = []
  const exclude = new Set()
  const offensive = moves.filter((move) => move.power && move.classSlug !== 'status')
  const support = moves.filter((move) => SUPPORT_MOVE_IDS.has(toID(move.slug)))

  const stabPool = (typeSlug) =>
    offensive.filter((move) => move.type === typeSlug)

  for (const typeSlug of types.slice(0, 2)) {
    const pick = weightedPick(stabPool(typeSlug), (move) => offensiveScore(move, preferPhysical), exclude)
    if (pick) {
      chosen.push(pick)
      exclude.add(pick.slug)
    }
  }
  while (chosen.filter((move) => types.includes(move.type) && move.power).length < 2) {
    const pick = weightedPick(
      offensive.filter((move) => types.includes(move.type)),
      (move) => offensiveScore(move, preferPhysical),
      exclude,
    )
    if (!pick) break
    chosen.push(pick)
    exclude.add(pick.slug)
  }

  const coverage = weightedPick(
    offensive.filter((move) => !types.includes(move.type)),
    (move) => offensiveScore(move, preferPhysical),
    exclude,
  )
  if (coverage) {
    chosen.push(coverage)
    exclude.add(coverage.slug)
  }

  const wantSupport = randomUnit() < SUPPORT_SLOT_CHANCE && support.length
  const fourth = wantSupport
    ? weightedPick(support, () => 1, exclude)
    : weightedPick(offensive, (move) => offensiveScore(move, preferPhysical), exclude)
  if (fourth) chosen.push(fourth)

  if (chosen.length < 4) {
    const rest = weightedPick(moves, (move) => offensiveScore(move, preferPhysical) || 10, exclude)
    if (rest) chosen.push(rest)
  }

  const unique = []
  const seen = new Set()
  for (const move of chosen) {
    if (seen.has(move.slug)) continue
    seen.add(move.slug)
    unique.push(move)
    if (unique.length === 4) break
  }
  if (!unique.length && moves[0]) unique.push(moves[0])
  return unique
}

export async function generateSet(pokemonIdOrSlug, { usedItems = new Set() } = {}) {
  const { isUsableMove, resolveSpecies, toID } = await dex()
  const pokemon = await getPokemon(pokemonIdOrSlug)
  const species = await getSpecies(pokemon.species?.name || pokemon.id)
  const dexSpecies = resolveSpecies(pokemon.name)
  const bases = baseStatsFromPokemon(pokemon)
  const nature = pickNature(bases)
  const stats = statsAtLevel(bases, nature)
  const preferPhysical = bases.atk >= bases.spa
  const types = (pokemon.types || []).map((entry) => entry.type.name)

  const learnset = await collectLearnset(pokemon.id)
  const moveDetails = []
  for (const slug of learnset.keys()) {
    if (!isUsableMove(slug)) continue
    try {
      const info = await moveInfo(slug)
      if (info) moveDetails.push(info)
    } catch {
      // attaque absente
    }
  }

  const moves = fillMoves(moveDetails, types, preferPhysical, toID)
  const ability = await pickAbility(pokemon)
  const item = await pickItem(usedItems)
  usedItems.add(item.slug)

  const typeInfos = types.map((slug) => ({
    slug,
    name: prettyTypeFallback(slug),
    color: TYPE_COLORS[slug] || '#888',
  }))

  return {
    pokemonId: pokemon.id,
    speciesId: species.id,
    slug: pokemon.name,
    species: dexSpecies.exists ? dexSpecies.name : pokemon.name,
    name: pickLocalizedName(species.names, pokemon.name),
    sprite: pokemon.sprites?.front_default,
    artwork:
      pokemon.sprites?.other?.['official-artwork']?.front_default ||
      pokemon.sprites?.front_default,
    types: typeInfos,
    ability,
    item,
    moves: moves.map((move) => ({
      ...move,
      typeName: prettyTypeFallback(move.type),
      color: TYPE_COLORS[move.type] || '#888',
    })),
    nature,
    level: BATTLE_LEVEL,
    stats,
    bases,
    evs: { hp: EV_EACH, atk: EV_EACH, def: EV_EACH, spa: EV_EACH, spd: EV_EACH, spe: EV_EACH },
    ivs: { hp: IV_EACH, atk: IV_EACH, def: IV_EACH, spa: IV_EACH, spd: IV_EACH, spe: IV_EACH },
  }
}

function prettyTypeFallback(slug) {
  const labels = {
    normal: 'Normal',
    fire: 'Feu',
    water: 'Eau',
    electric: 'Électrik',
    grass: 'Plante',
    ice: 'Glace',
    fighting: 'Combat',
    poison: 'Poison',
    ground: 'Sol',
    flying: 'Vol',
    psychic: 'Psy',
    bug: 'Insecte',
    rock: 'Roche',
    ghost: 'Spectre',
    dragon: 'Dragon',
    dark: 'Ténèbres',
    steel: 'Acier',
    fairy: 'Fée',
  }
  return labels[slug] || slug
}

export async function generateTeamSets(finalTeam) {
  const usedItems = new Set()
  const sets = []
  for (const member of finalTeam || []) {
    const target = member.pokemonId || member.slug
    const set = await generateSet(target, { usedItems })
    set.fromId = member.fromId || member.pokemonId
    sets.push(set)
  }
  return sets
}

