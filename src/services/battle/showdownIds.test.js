import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveSpecies, toPackedTeam, validatePackedSet } from './showdownIds.js'

describe('correspondance PokéAPI → Showdown', () => {
  it('résout les noms spéciaux', () => {
    assert.equal(resolveSpecies('mr-mime').name, 'Mr. Mime')
    assert.equal(resolveSpecies('nidoran-f').name, 'Nidoran-F')
    assert.equal(resolveSpecies('type-null').name, 'Type: Null')
    assert.equal(resolveSpecies('tapu-koko').name, 'Tapu Koko')
    assert.equal(resolveSpecies('giratina-altered').name, 'Giratina')
    assert.equal(resolveSpecies('deoxys-attack').name, 'Deoxys-Attack')
    assert.equal(resolveSpecies('indeedee-male').name, 'Indeedee')
    assert.equal(resolveSpecies('tauros-paldea-combat-breed').name, 'Tauros-Paldea-Combat')
  })

  it('valide un set packable', () => {
    const set = {
      species: 'Pikachu',
      ability: { slug: 'static' },
      item: { slug: 'leftovers' },
      moves: [{ slug: 'thunderbolt' }, { slug: 'volt-switch' }],
      nature: 'timid',
      evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 50,
    }
    assert.equal(validatePackedSet(set).ok, true)
    assert.ok(toPackedTeam([set]).length > 10)
  })
})
