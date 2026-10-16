import { Dex, Teams, toID } from '@pkmn/sim'

const SLUG_REWRITES = [
  [/-male$/, ''],
  [/-female$/, '-f'],
  [/-family-of-three$/, ''],
  [/-family-of-four$/, '-four'],
  [/-combat-breed$/, '-combat'],
  [/-blaze-breed$/, '-blaze'],
  [/-aqua-breed$/, '-aqua'],
  [/^minior-.+-meteor$/, 'minior'],
  [/^minior-red$/, 'minior'],
  [/-galar-standard$/, '-galar'],
  [/-own-tempo$/, ''],
]

export { toID, Teams, Dex }

export function rewritePokeapiSlug(slug) {
  let current = String(slug || '').toLowerCase()
  for (const [pattern, replacement] of SLUG_REWRITES) {
    if (pattern.test(current)) current = current.replace(pattern, replacement)
  }
  return current
}

export function resolveSpecies(slug) {
  const tries = [slug, rewritePokeapiSlug(slug)]
  if (tries[1] && tries[1] !== slug) tries.push(rewritePokeapiSlug(tries[1]))
  for (const name of tries) {
    if (!name) continue
    const species = Dex.species.get(name)
    if (species.exists) return species
  }
  return Dex.species.get(slug || '')
}

export function resolveMove(slug) {
  return Dex.moves.get(slug || '')
}

export function resolveAbility(slug) {
  return Dex.abilities.get(slug || '')
}

export function resolveItem(slug) {
  return Dex.items.get(slug || '')
}

export function isKnownSpecies(slug) {
  return resolveSpecies(slug).exists
}

export function isKnownMove(slug) {
  const move = resolveMove(slug)
  return Boolean(move.exists && !move.isNonstandard || move.exists)
}

export function isUsableMove(slug) {
  const move = resolveMove(slug)
  if (!move.exists) return false
  if (move.isMax || move.isZ) return false
  return true
}

export function isKnownAbility(slug) {
  return resolveAbility(slug).exists
}

export function isKnownItem(slug) {
  return resolveItem(slug).exists
}

export function toPackedTeam(sets) {
  return Teams.pack(
    (sets || []).map((set) => ({
      species: set.species,
      item: set.item?.slug || set.item || '',
      ability: set.ability?.slug || set.ability || '',
      moves: (set.moves || []).map((move) => move.slug || move),
      nature: set.nature,
      evs: set.evs,
      ivs: set.ivs,
      level: set.level || 50,
      gender: set.gender || '',
    })),
  )
}

export function sanitizeSetForSim(set) {
  const moves = (set.moves || []).filter((move) => isUsableMove(move.slug || move))
  const abilitySlug = set.ability?.slug || set.ability
  const ability = resolveAbility(abilitySlug)
  const item = resolveItem(set.item?.slug || set.item)
  const species = resolveSpecies(set.species || set.slug)
  return {
    ...set,
    species: species.exists ? species.name : set.species,
    ability: ability.exists
      ? {
          ...(typeof set.ability === 'object' ? set.ability : {}),
          slug: set.ability?.slug || ability.id,
          showdown: ability.name,
        }
      : { slug: 'noability', name: 'Aucun talent', showdown: 'No Ability' },
    item: item.exists ? set.item : { slug: 'leftovers', name: 'Restes', showdown: 'Leftovers' },
    moves,
  }
}

export function validatePackedSet(set) {
  const failures = []
  const species = resolveSpecies(set.species || set.slug)
  if (!species.exists) failures.push(`espèce inconnue: ${set.species || set.slug}`)
  const abilitySlug = set.ability?.slug || set.ability
  if (abilitySlug && !isKnownAbility(abilitySlug)) failures.push(`talent inconnu: ${abilitySlug}`)
  const itemSlug = set.item?.slug || set.item
  if (itemSlug && !isKnownItem(itemSlug)) failures.push(`objet inconnu: ${itemSlug}`)
  for (const move of set.moves || []) {
    const slug = move.slug || move
    if (slug && !isUsableMove(slug)) failures.push(`attaque inconnue: ${slug}`)
  }
  return { ok: failures.length === 0, failures, species: species.exists ? species.name : null }
}
