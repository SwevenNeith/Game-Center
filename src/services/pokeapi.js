const API = 'https://pokeapi.co/api/v2'
const GRAPHQL = 'https://beta.pokeapi.co/graphql/v1beta'
const INDEX_KEY = 'gamecenter.pokedex-index-v1'

const memory = {
  index: null,
  indexPromise: null,
  pokemon: new Map(),
  species: new Map(),
  names: new Map(),
  types: new Map(),
  abilities: new Map(),
  items: new Map(),
  evolution: new Map(),
}

export const TYPE_COLORS = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
  stellar: '#40B5A4',
}

export const STAT_LABELS = {
  hp: 'PV',
  attack: 'Attaque',
  defense: 'Défense',
  'special-attack': 'Atq. Spé.',
  'special-defense': 'Déf. Spé.',
  speed: 'Vitesse',
}

const DAMAGE_CLASS_FR = {
  physical: 'Physique',
  special: 'Spécial',
  status: 'Statut',
}

const TRIGGER_FR = {
  'level-up': 'Monte de niveau',
  trade: 'Échange',
  'use-item': 'Utilise un objet',
  shed: 'Place libre dans l’équipe + Poké Ball',
  spin: 'Tourne sur soi-même',
  'tower-of-darkness': 'Tour des Ténèbres',
  'tower-of-waters': 'Tour des Eaux',
  'three-critical-hits': 'Trois coups critiques',
  'take-damage': 'Subit des dégâts',
  other: 'Condition spéciale',
  'agile-style-move': 'Capacité style Agile',
  'strong-style-move': 'Capacité style Puissant',
  'recoil-damage': 'Dégâts de recul',
}

function speciesIdFromUrl(url) {
  const match = String(url || '').match(/\/pokemon-species\/(\d+)\/?$/)
  return match ? Number(match[1]) : null
}

function idFromUrl(url, kind) {
  const match = String(url || '').match(new RegExp(`/${kind}/(\\d+)/?$`))
  return match ? Number(match[1]) : null
}

function prettySlug(slug) {
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function pickLocalizedName(entries, fallback) {
  const fr = entries?.find((entry) => entry.language?.name === 'fr')
  return fr?.name || prettySlug(fallback)
}

function cleanText(value) {
  return String(value || '')
    .replace(/\f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`PokéAPI ${response.status}`)
  return response.json()
}

async function loadIndexFromApi() {
  const data = await fetchJson(`${API}/pokemon-species?limit=2000`)
  const index = (data.results || [])
    .map((entry) => {
      const id = speciesIdFromUrl(entry.url)
      return id
        ? {
            id,
            slug: entry.name,
            en: entry.name.replace(/-/g, ' '),
            fr: '',
          }
        : null
    })
    .filter(Boolean)

  try {
    const graphql = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query {
          pokemon_v2_pokemonspeciesname(where: { pokemon_v2_language: { name: { _eq: "fr" } } }) {
            name
            pokemon_species_id
          }
        }`,
      }),
    })
    if (graphql.ok) {
      const json = await graphql.json()
      const names = json?.data?.pokemon_v2_pokemonspeciesname || []
      const byId = new Map(names.map((row) => [row.pokemon_species_id, row.name]))
      for (const item of index) {
        if (byId.has(item.id)) item.fr = byId.get(item.id)
      }
    }
  } catch {
    // Les noms FR viendront des fiches espèce.
  }

  return index
}

export async function loadPokedexIndex() {
  if (memory.index) return memory.index
  if (memory.indexPromise) return memory.indexPromise

  memory.indexPromise = (async () => {
    try {
      const cached = localStorage.getItem(INDEX_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 800) {
          memory.index = parsed
          return parsed
        }
      }
    } catch {
      // ignore cache corrompu
    }

    const index = await loadIndexFromApi()
    memory.index = index
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(index))
    } catch {
      // quota
    }
    return index
  })()

  try {
    return await memory.indexPromise
  } finally {
    memory.indexPromise = null
  }
}

function normalizeQuery(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export async function searchPokemon(query, limit = 12) {
  const q = normalizeQuery(query)
  if (!q) return []

  const index = await loadPokedexIndex()
  const asNumber = Number(q.replace(/^#/, ''))
  const numeric = Number.isInteger(asNumber) && asNumber > 0

  const scored = []
  for (const item of index) {
    const fr = normalizeQuery(item.fr)
    const en = normalizeQuery(item.en)
    const slug = normalizeQuery(item.slug)
    const num = String(item.id)

    let score = 0
    if (numeric && item.id === asNumber) score = 100
    else if (fr === q || en === q || slug === q || num === q) score = 90
    else if (fr.startsWith(q) || en.startsWith(q) || slug.startsWith(q)) score = 70
    else if (fr.includes(q) || en.includes(q) || slug.includes(q) || num.includes(q)) score = 40

    if (score) scored.push({ ...item, score })
  }

  scored.sort((a, b) => b.score - a.score || a.id - b.id)
  return scored.slice(0, limit)
}

async function getSpecies(id) {
  if (memory.species.has(id)) return memory.species.get(id)
  const data = await fetchJson(`${API}/pokemon-species/${id}`)
  memory.species.set(id, data)
  return data
}

async function getPokemon(idOrSlug) {
  const key = String(idOrSlug)
  if (memory.pokemon.has(key)) return memory.pokemon.get(key)
  const data = await fetchJson(`${API}/pokemon/${idOrSlug}`)
  memory.pokemon.set(key, data)
  memory.pokemon.set(String(data.id), data)
  return data
}

async function getNamedResource(kind, name) {
  if (!name) return ''
  const key = `${kind}:${name}`
  if (memory.names.has(key)) return memory.names.get(key)
  try {
    const data = await fetchJson(`${API}/${kind}/${name}`)
    const label = pickLocalizedName(data.names, name)
    memory.names.set(key, label)
    return label
  } catch {
    const fallback = prettySlug(name)
    memory.names.set(key, fallback)
    return fallback
  }
}

async function getTypeInfo(name) {
  if (memory.types.has(name)) return memory.types.get(name)
  const data = await fetchJson(`${API}/type/${name}`)
  const info = {
    slug: name,
    name: pickLocalizedName(data.names, name),
    color: TYPE_COLORS[name] || '#888',
    doubleFrom: (data.damage_relations?.double_damage_from || []).map((entry) => entry.name),
    halfFrom: (data.damage_relations?.half_damage_from || []).map((entry) => entry.name),
    noneFrom: (data.damage_relations?.no_damage_from || []).map((entry) => entry.name),
  }
  memory.types.set(name, info)
  return info
}

async function getAbilityInfo(name) {
  if (memory.abilities.has(name)) return memory.abilities.get(name)
  const data = await fetchJson(`${API}/ability/${name}`)
  const effectFr = data.effect_entries?.find((entry) => entry.language?.name === 'fr')
  const flavor = [...(data.flavor_text_entries || [])]
    .reverse()
    .find((entry) => entry.language?.name === 'fr')
  const info = {
    slug: name,
    name: pickLocalizedName(data.names, name),
    effect: cleanText(effectFr?.short_effect || effectFr?.effect || flavor?.flavor_text || ''),
  }
  memory.abilities.set(name, info)
  return info
}

async function getItemName(name) {
  if (!name) return ''
  if (memory.items.has(name)) return memory.items.get(name)
  const label = await getNamedResource('item', name)
  memory.items.set(name, label)
  return label
}

function nameFromIndex(slug, id) {
  const item = memory.index?.find((entry) => entry.slug === slug || entry.id === id)
  return item?.fr || prettySlug(slug)
}

function genderLabel(rate) {
  if (rate == null || rate < 0) return 'Asexué'
  const female = (rate / 8) * 100
  const male = 100 - female
  if (female === 0) return '100 % mâle'
  if (male === 0) return '100 % femelle'
  return `${male % 1 ? male.toFixed(1) : male} % mâle · ${female % 1 ? female.toFixed(1) : female} % femelle`
}

function combineWeaknesses(types) {
  const multipliers = {}
  for (const type of types) {
    for (const slug of type.doubleFrom) multipliers[slug] = (multipliers[slug] ?? 1) * 2
    for (const slug of type.halfFrom) multipliers[slug] = (multipliers[slug] ?? 1) * 0.5
    for (const slug of type.noneFrom) multipliers[slug] = 0
  }

  const groups = { x4: [], x2: [], x05: [], x025: [], x0: [] }
  for (const [slug, value] of Object.entries(multipliers)) {
    if (value === 4) groups.x4.push(slug)
    else if (value === 2) groups.x2.push(slug)
    else if (value === 0.5) groups.x05.push(slug)
    else if (value === 0.25) groups.x025.push(slug)
    else if (value === 0) groups.x0.push(slug)
  }
  return groups
}

function collectFlavorGroups(entries) {
  const grouped = new Map()
  for (const entry of entries || []) {
    if (entry.language?.name !== 'fr') continue
    const text = cleanText(entry.flavor_text)
    if (!text) continue
    if (!grouped.has(text)) grouped.set(text, [])
    grouped.get(text).push(entry.version?.name)
  }
  return [...grouped.entries()].map(([text, versions]) => ({
    text,
    versions: versions.filter(Boolean),
  }))
}

function flattenEvolution(node, acc = [], fromSlug = null) {
  const slug = node.species?.name
  const id = speciesIdFromUrl(node.species?.url)
  acc.push({
    id,
    slug,
    fromSlug,
    details: node.evolution_details || [],
    isLeaf: !node.evolves_to?.length,
  })
  for (const child of node.evolves_to || []) {
    flattenEvolution(child, acc, slug)
  }
  return acc
}

async function formatEvolutionDetails(details) {
  if (!details?.length) return []
  const lines = []
  for (const detail of details) {
    const parts = []
    const trigger = TRIGGER_FR[detail.trigger?.name] || prettySlug(detail.trigger?.name)
    if (trigger) parts.push(trigger)
    if (detail.min_level) parts.push(`niveau ${detail.min_level}`)
    if (detail.item?.name) parts.push(await getItemName(detail.item.name))
    if (detail.held_item?.name) parts.push(`tient ${await getItemName(detail.held_item.name)}`)
    if (detail.known_move?.name) {
      parts.push(`connaît ${prettySlug(detail.known_move.name)}`)
    }
    if (detail.known_move_type?.name) {
      const typeName = await getNamedResource('type', detail.known_move_type.name)
      parts.push(`connaît une capacité ${typeName}`)
    }
    if (detail.min_happiness) parts.push(`bonheur ≥ ${detail.min_happiness}`)
    if (detail.min_affection) parts.push(`affection ≥ ${detail.min_affection}`)
    if (detail.min_beauty) parts.push(`beauté ≥ ${detail.min_beauty}`)
    if (detail.time_of_day) {
      parts.push(detail.time_of_day === 'day' ? 'le jour' : detail.time_of_day === 'night' ? 'la nuit' : detail.time_of_day)
    }
    if (detail.location?.name) parts.push(`à ${prettySlug(detail.location.name)}`)
    if (detail.gender === 1) parts.push('femelle')
    if (detail.gender === 2) parts.push('mâle')
    if (detail.needs_overworld_rain) parts.push('sous la pluie')
    if (detail.turn_upside_down) parts.push('console à l’envers')
    if (detail.relative_physical_stats === 1) parts.push('Attaque > Défense')
    if (detail.relative_physical_stats === -1) parts.push('Attaque < Défense')
    if (detail.relative_physical_stats === 0 && detail.relative_physical_stats != null) {
      parts.push('Attaque = Défense')
    }
    if (detail.trade_species?.name) parts.push(`contre ${prettySlug(detail.trade_species.name)}`)
    if (parts.length) lines.push(parts.join(' · '))
  }
  return [...new Set(lines)]
}

async function getEvolution(url) {
  if (!url) return null
  if (memory.evolution.has(url)) return memory.evolution.get(url)
  const data = await fetchJson(url)
  memory.evolution.set(url, data)
  return data
}

async function getMoveDetails(ids) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return new Map()

  try {
    const response = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($ids: [Int!]!) {
          pokemon_v2_move(where: { id: { _in: $ids } }) {
            id
            name
            power
            accuracy
            pp
            pokemon_v2_type { name }
            pokemon_v2_movedamageclass { name }
            pokemon_v2_movenames(where: { pokemon_v2_language: { name: { _eq: "fr" } } }) {
              name
            }
          }
        }`,
        variables: { ids: unique },
      }),
    })
    if (!response.ok) return new Map()
    const json = await response.json()
    const rows = json?.data?.pokemon_v2_move || []
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          slug: row.name,
          name: row.pokemon_v2_movenames?.[0]?.name || prettySlug(row.name),
          power: row.power,
          accuracy: row.accuracy,
          pp: row.pp,
          typeSlug: row.pokemon_v2_type?.name,
          classSlug: row.pokemon_v2_movedamageclass?.name,
        },
      ]),
    )
  } catch {
    return new Map()
  }
}

function pickLevelUpMoves(moves) {
  const learned = []
  for (const entry of moves || []) {
    const levels = (entry.version_group_details || [])
      .filter((detail) => detail.move_learn_method?.name === 'level-up' && detail.level_learned_at > 0)
      .map((detail) => detail.level_learned_at)
    if (!levels.length) continue
    learned.push({
      slug: entry.move.name,
      id: idFromUrl(entry.move.url, 'move'),
      level: Math.min(...levels),
    })
  }
  learned.sort((a, b) => a.level - b.level || a.id - b.id)
  return learned
}

export async function getPokemonDetails(idOrSlug) {
  const pokemon = await getPokemon(idOrSlug)
  const species = await getSpecies(pokemon.species?.name || pokemon.id)
  await loadPokedexIndex()

  const typeInfos = await Promise.all(pokemon.types.map((entry) => getTypeInfo(entry.type.name)))
  const abilityInfos = await Promise.all(
    pokemon.abilities.map(async (entry) => {
      const info = await getAbilityInfo(entry.ability.name)
      return { ...info, hidden: Boolean(entry.is_hidden), slot: entry.slot }
    }),
  )

  const flavorGroups = collectFlavorGroups(species.flavor_text_entries)
  const versionNames = [
    ...new Set(flavorGroups.flatMap((group) => group.versions)),
  ]
  const versionLabels = Object.fromEntries(
    await Promise.all(
      versionNames.map(async (slug) => [slug, await getNamedResource('version', slug)]),
    ),
  )
  const flavors = flavorGroups.map((group) => ({
    text: group.text,
    versions: group.versions.map((slug) => versionLabels[slug] || prettySlug(slug)),
  }))

  const [generation, habitat, shape, color, growthRate, ...eggGroups] = await Promise.all([
    getNamedResource('generation', species.generation?.name),
    getNamedResource('pokemon-habitat', species.habitat?.name),
    getNamedResource('pokemon-shape', species.shape?.name),
    getNamedResource('pokemon-color', species.color?.name),
    getNamedResource('growth-rate', species.growth_rate?.name),
    ...(species.egg_groups || []).map((group) => getNamedResource('egg-group', group.name)),
  ])

  const weaknessSlugs = combineWeaknesses(typeInfos)
  const allWeakSlugs = [
    ...weaknessSlugs.x4,
    ...weaknessSlugs.x2,
    ...weaknessSlugs.x05,
    ...weaknessSlugs.x025,
    ...weaknessSlugs.x0,
  ]
  const extraTypeLabels = Object.fromEntries(
    await Promise.all(
      [...new Set(allWeakSlugs)]
        .filter((slug) => !typeInfos.some((type) => type.slug === slug))
        .map(async (slug) => {
          const info = await getTypeInfo(slug)
          return [slug, info]
        }),
    ),
  )
  const typeBySlug = {
    ...Object.fromEntries(typeInfos.map((type) => [type.slug, type])),
    ...extraTypeLabels,
  }
  const mapTypes = (slugs) => slugs.map((slug) => typeBySlug[slug]).filter(Boolean)

  const evolutionData = await getEvolution(species.evolution_chain?.url)
  const chainFlat = evolutionData?.chain ? flattenEvolution(evolutionData.chain) : []
  const evolution = await Promise.all(
    chainFlat.map(async (node) => ({
      id: node.id,
      slug: node.slug,
      name: nameFromIndex(node.slug, node.id),
      isCurrent: node.id === species.id || node.slug === species.name,
      how: await formatEvolutionDetails(node.details),
    })),
  )

  const currentNode = chainFlat.find((node) => node.id === species.id || node.slug === species.name)
  let evolutionStatus = 'Forme unique'
  if (chainFlat.length > 1) {
    if (!currentNode?.fromSlug) evolutionStatus = 'Premier stade'
    else if (currentNode.isLeaf) evolutionStatus = 'Forme finale'
    else evolutionStatus = 'Stade intermédiaire'
  }

  const levelMoves = pickLevelUpMoves(pokemon.moves)
  const moveDetails = await getMoveDetails(levelMoves.map((move) => move.id))
  const moves = levelMoves.map((move) => {
    const extra = moveDetails.get(move.id)
    return {
      level: move.level,
      name: extra?.name || prettySlug(move.slug),
      type: extra?.typeSlug ? typeBySlug[extra.typeSlug] || { slug: extra.typeSlug, name: prettySlug(extra.typeSlug), color: TYPE_COLORS[extra.typeSlug] } : null,
      className: DAMAGE_CLASS_FR[extra?.classSlug] || '',
      power: extra?.power ?? '—',
      accuracy: extra?.accuracy ?? '—',
      pp: extra?.pp ?? '—',
    }
  })

  const missingMoveTypes = [...new Set(moves.map((move) => move.type?.slug).filter(Boolean))].filter(
    (slug) => !typeBySlug[slug],
  )
  if (missingMoveTypes.length) {
    await Promise.all(
      missingMoveTypes.map(async (slug) => {
        typeBySlug[slug] = await getTypeInfo(slug)
      }),
    )
    for (const move of moves) {
      if (move.type?.slug && typeBySlug[move.type.slug]) move.type = typeBySlug[move.type.slug]
    }
  }

  const heldItems = await Promise.all(
    (pokemon.held_items || []).map(async (entry) => getItemName(entry.item.name)),
  )

  const frName = pickLocalizedName(species.names, pokemon.name)
  const genus = pickLocalizedName(species.genera, '')
  const artwork =
    pokemon.sprites?.other?.['official-artwork']?.front_default ||
    pokemon.sprites?.other?.home?.front_default ||
    pokemon.sprites?.front_default
  const shinyArtwork =
    pokemon.sprites?.other?.['official-artwork']?.front_shiny ||
    pokemon.sprites?.other?.home?.front_shiny ||
    pokemon.sprites?.front_shiny

  if (memory.index) {
    const row = memory.index.find((item) => item.id === pokemon.id || item.id === species.id)
    if (row && frName) row.fr = frName
  }

  const stats = pokemon.stats.map((entry) => ({
    name: entry.stat.name,
    value: entry.base_stat,
  }))

  return {
    id: pokemon.id,
    speciesId: species.id,
    slug: pokemon.name,
    name: frName,
    englishName: prettySlug(pokemon.name),
    genus,
    types: typeInfos,
    weaknesses: {
      x4: mapTypes(weaknessSlugs.x4),
      x2: mapTypes(weaknessSlugs.x2),
      x05: mapTypes(weaknessSlugs.x05),
      x025: mapTypes(weaknessSlugs.x025),
      x0: mapTypes(weaknessSlugs.x0),
    },
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    stats,
    statTotal: stats.reduce((sum, stat) => sum + stat.value, 0),
    baseExperience: pokemon.base_experience,
    abilities: abilityInfos,
    artwork,
    shinyArtwork,
    sprite: pokemon.sprites?.front_default,
    cry: pokemon.cries?.latest || pokemon.cries?.legacy || '',
    generation,
    habitat,
    shape,
    color,
    growthRate,
    eggGroups: eggGroups.filter(Boolean),
    gender: genderLabel(species.gender_rate),
    captureRate: species.capture_rate,
    baseHappiness: species.base_happiness,
    hatchSteps: species.hatch_counter != null ? species.hatch_counter * 256 : null,
    isBaby: species.is_baby,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    evolutionStatus,
    evolvesFrom: species.evolves_from_species
      ? nameFromIndex(species.evolves_from_species.name, speciesIdFromUrl(species.evolves_from_species.url))
      : null,
    evolution,
    flavors,
    varieties: (species.varieties || []).map((entry) => ({
      name: prettySlug(entry.pokemon.name),
      isDefault: entry.is_default,
    })),
    heldItems: heldItems.filter(Boolean),
    moves,
    pokedexNumbers: (species.pokedex_numbers || []).map((entry) => ({
      dex: prettySlug(entry.pokedex.name),
      number: entry.entry_number,
    })),
  }
}

export async function fillFrenchNames() {
  const index = await loadPokedexIndex()
  const missing = index.filter((item) => !item.fr)
  const queue = [...missing]
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      try {
        const species = await getSpecies(item.id)
        item.fr = pickLocalizedName(species.names, item.en)
      } catch {
        // ignore une espèce en échec
      }
    }
  })
  await Promise.all(workers)
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // quota
  }
}
