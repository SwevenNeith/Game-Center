import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Dex } from '@pkmn/sim'
import { generateSet } from './sets.js'
import { toPackedTeam, validatePackedSet } from './showdownIds.js'

const SAMPLE = ['venusaur', 'raichu', 'ditto', 'smeargle', 'vaporeon', 'mr-mime', 'nidoking']

async function checkSpecies(slug) {
  const set = await generateSet(slug)
  const check = validatePackedSet(set)
  const packed = toPackedTeam([set])
  const unpacked = Dex.species.get(set.species)
  return {
    slug,
    species: set.species,
    ok: check.ok && unpacked.exists && packed.length > 0,
    failures: check.failures,
    moves: (set.moves || []).map((move) => move.slug),
    ability: set.ability?.slug,
    item: set.item?.slug,
  }
}

describe('validation des sets Showdown', () => {
  it('génère un set accepté pour un échantillon de Pokémon finaux', async (t) => {
    t.timeout = 120000
    const failures = []
    for (const slug of SAMPLE) {
      try {
        const result = await checkSpecies(slug)
        if (!result.ok) failures.push(result)
      } catch (error) {
        failures.push({ slug, failures: [error.message] })
      }
    }
    if (failures.length) console.error(failures)
    assert.deepEqual(failures, [])
  })

  it('parcourt tous les Pokémon finaux du Dex gen 9', { skip: process.env.FULL_SET_TEST !== '1' }, async (t) => {
    t.timeout = 600000
    const failures = []
    const species = Dex.species.all().filter(
      (entry) =>
        entry.exists &&
        !entry.isNonstandard &&
        !entry.nfe &&
        !entry.isMega &&
        !entry.isGigantamax &&
        !entry.battleOnly,
    )
    for (const entry of species) {
      try {
        const result = await checkSpecies(entry.id)
        if (!result.ok) failures.push(result)
      } catch (error) {
        failures.push({ slug: entry.id, failures: [error.message] })
      }
    }
    console.log(`validés: ${species.length - failures.length}/${species.length}`)
    if (failures.length) console.error(failures.slice(0, 40))
    assert.ok(failures.length < species.length * 0.05)
  })
})
