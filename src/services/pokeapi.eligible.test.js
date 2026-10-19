import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { eligibleStarterSpecies, isParadoxPokemon, PARADOX_SPECIES_IDS } from './pokeapi.js'

describe('tirage aléatoire', () => {
  it('exclut les Pokémon Paradoxe', () => {
    assert.equal(isParadoxPokemon({ id: 1007 }), true)
    assert.equal(isParadoxPokemon({ id: 25 }), false)
    const pool = eligibleStarterSpecies([
      { id: 25, slug: 'pikachu' },
      { id: 1007, slug: 'koraidon' },
      { id: 3, slug: 'venusaur-mega' },
      { id: 6, slug: 'charizard' },
    ])
    assert.deepEqual(
      pool.map((item) => item.id),
      [25, 6],
    )
    assert.ok(PARADOX_SPECIES_IDS.has(984))
    assert.ok(!PARADOX_SPECIES_IDS.has(1000))
  })
})
