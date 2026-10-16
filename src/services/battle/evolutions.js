import { COSMETIC_VARIETY, EXCLUDED_FORM } from './config.js'
import {
  getEvolutionChainByUrl,
  getPokemon,
  getPokemonForm,
  getSpecies,
  pickLocalizedName,
} from './pokeCache.js'
function speciesIdFromUrl(url) {
  const match = String(url || '').match(/\/pokemon-species\/(\d+)\/?$/)
  return match ? Number(match[1]) : null
}

function collectLeaves(node, acc = []) {
  if (!node?.species) return acc
  if (!node.evolves_to?.length) {
    acc.push({
      slug: node.species.name,
      id: speciesIdFromUrl(node.species.url),
    })
    return acc
  }
  for (const child of node.evolves_to) collectLeaves(child, acc)
  return acc
}

function findChainNode(node, species) {
  if (!node?.species || !species) return null
  const id = speciesIdFromUrl(node.species.url)
  if (id === species.id || node.species.name === species.name) return node
  for (const child of node.evolves_to || []) {
    const found = findChainNode(child, species)
    if (found) return found
  }
  return null
}

async function optionFromPokemon(pokemon, leafSpecies, extra = {}) {
  const formName = pokemon.forms?.[0]?.name
  let form = {}
  if (formName) {
    try {
      form = await getPokemonForm(formName)
    } catch {
      form = {}
    }
  }
  if (isExcludedBattleForm(pokemon.name, form)) return null
  return {
    speciesId: leafSpecies.id,
    pokemonId: pokemon.id,
    slug: pokemon.name,
    name: pickLocalizedName(leafSpecies.names, pokemon.name),
    sprite: pokemon.sprites?.front_default,
    artwork:
      pokemon.sprites?.other?.['official-artwork']?.front_default ||
      pokemon.sprites?.front_default,
    isDefault: true,
    ...extra,
  }
}

export function isExcludedBattleForm(slug, form = {}) {
  if (form.is_mega || form.is_battle_only) return true
  if (EXCLUDED_FORM.test(slug)) return true
  if (COSMETIC_VARIETY.test(slug)) return true
  return false
}

async function varietyOption(variety, leafSpecies) {
  const slug = variety.pokemon?.name
  if (!slug) return null
  if (EXCLUDED_FORM.test(slug) || COSMETIC_VARIETY.test(slug)) return null
  const pokemon = await getPokemon(slug)
  const formName = pokemon.forms?.[0]?.name
  let form = {}
  if (formName) {
    try {
      form = await getPokemonForm(formName)
    } catch {
      form = {}
    }
  }
  if (isExcludedBattleForm(slug, form)) return null

  return {
    speciesId: leafSpecies.id,
    pokemonId: pokemon.id,
    slug: pokemon.name,
    name: pickLocalizedName(leafSpecies.names, pokemon.name),
    sprite: pokemon.sprites?.front_default,
    artwork:
      pokemon.sprites?.other?.['official-artwork']?.front_default ||
      pokemon.sprites?.front_default,
    isDefault: Boolean(variety.is_default),
  }
}

export async function getFinalEvolutions(speciesIdOrSlug) {
  const species = await getSpecies(speciesIdOrSlug)
  const chain = await getEvolutionChainByUrl(species.evolution_chain?.url)
  const start = chain?.chain ? findChainNode(chain.chain, species) : null
  const lockedLeaf = !start?.evolves_to?.length

  const options = []
  if (lockedLeaf) {
    try {
      const pokemon = await getPokemon(speciesIdOrSlug)
      const option = await optionFromPokemon(pokemon, species, { locked: true, isDefault: true })
      if (option) options.push(option)
    } catch {
      // on retombe sur le fallback plus bas
    }
  } else {
    const leaves = collectLeaves(start)
    const unique = []
    const seen = new Set()
    for (const leaf of leaves) {
      const key = leaf.id || leaf.slug
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(leaf)
    }
    for (const leaf of unique) {
      const leafSpecies = await getSpecies(leaf.id || leaf.slug)
      const varieties = leafSpecies.varieties?.length
        ? leafSpecies.varieties
        : [{ pokemon: { name: leafSpecies.name }, is_default: true }]
      for (const variety of varieties) {
        try {
          const option = await varietyOption(variety, leafSpecies)
          if (option) options.push(option)
        } catch {
          // variété introuvable : on ignore
        }
      }
    }
  }

  if (!options.length) {
    const pokemon = await getPokemon(species.id)
    const fallback = await optionFromPokemon(pokemon, species, { locked: true, isDefault: true })
    if (fallback) options.push(fallback)
  }

  const fromName = pickLocalizedName(species.names, species.name)
  return {
    fromId: species.id,
    fromSlug: species.name,
    fromName,
    locked: Boolean(lockedLeaf),
    options,
    auto: options.length === 1 ? options[0] : null,
  }
}

export async function getFinalsForTeam(ids) {
  const result = []
  for (const id of ids || []) {
    result.push(await getFinalEvolutions(id))
  }
  return result
}
