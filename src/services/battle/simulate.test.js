import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runOneBattle, runSimulations } from './simulate.js'

function fakeSet(species, types, moves, ability = 'Blaze') {
  return {
    species,
    slug: species.toLowerCase(),
    name: species,
    types: types.map((slug) => ({ slug, name: slug })),
    ability: { slug: ability.toLowerCase(), name: ability },
    item: { slug: 'leftovers', name: 'Restes' },
    moves: moves.map((slug) => ({
      slug,
      name: slug,
      type: types[0],
      classSlug: 'special',
      power: 90,
      accuracy: 100,
      priority: 0,
    })),
    nature: 'modest',
    level: 50,
    stats: { hp: 160, atk: 80, def: 90, spa: 120, spd: 90, spe: 100 },
    evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  }
}

describe('simulation complète', () => {
  it('termine un combat singles 2v2', async () => {
    const typeChart = {
      fire: { double: ['grass'], half: ['fire', 'water'], none: [] },
      water: { double: ['fire'], half: ['water', 'grass'], none: [] },
      grass: { double: ['water'], half: ['grass', 'fire'], none: [] },
      flying: { double: ['grass'], half: ['electric'], none: [] },
      electric: { double: ['water', 'flying'], half: ['electric', 'grass'], none: [] },
    }
    const host = [
      fakeSet('Raichu', ['electric'], ['thunderbolt', 'volt-switch', 'surf', 'protect'], 'Static'),
      fakeSet('Charizard', ['fire', 'flying'], ['flamethrower', 'air-slash', 'dragon-pulse', 'earthquake'], 'Blaze'),
    ]
    const guest = [
      fakeSet('Blastoise', ['water'], ['surf', 'ice-beam', 'flash-cannon', 'protect'], 'Torrent'),
      fakeSet('Venusaur', ['grass'], ['giga-drain', 'sludge-bomb', 'earthquake', 'protect'], 'Overgrow'),
    ]
    const battle = await runOneBattle({
      hostSets: host,
      guestSets: guest,
      hostName: 'host',
      guestName: 'guest',
      seed: [1, 2, 3, 4],
      typeChart,
    })
    assert.ok(['host', 'guest', 'tie'].includes(battle.winner))
    assert.ok(battle.turns > 0)
    assert.ok(battle.recap.length > 3)
    const damage =
      battle.hostStats.reduce((sum, row) => sum + row.damage, 0) +
      battle.guestStats.reduce((sum, row) => sum + row.damage, 0)
    assert.ok(damage > 0)
  })

  it('enchaîne 40 combats 6v6 en quelques secondes', async () => {
    const typeChart = {
      fire: { double: ['grass'], half: ['fire', 'water'], none: [] },
      water: { double: ['fire'], half: ['water', 'grass'], none: [] },
      grass: { double: ['water'], half: ['grass', 'fire'], none: [] },
      flying: { double: ['grass'], half: ['electric'], none: [] },
      electric: { double: ['water', 'flying'], half: ['electric', 'grass'], none: [] },
      ghost: { double: ['ghost'], half: [], none: [] },
      poison: { double: ['grass'], half: ['poison'], none: [] },
      normal: { double: [], half: [], none: ['ghost'] },
    }
    const host = [
      fakeSet('Raichu', ['electric'], ['thunderbolt', 'volt-switch', 'surf', 'protect'], 'Static'),
      fakeSet('Charizard', ['fire', 'flying'], ['flamethrower', 'air-slash', 'dragon-pulse', 'earthquake'], 'Blaze'),
      fakeSet('Gengar', ['ghost', 'poison'], ['shadow-ball', 'sludge-bomb', 'focus-blast', 'protect'], 'Cursed Body'),
      fakeSet('Snorlax', ['normal'], ['body-slam', 'earthquake', 'crunch', 'rest'], 'Thick Fat'),
      fakeSet('Dragonite', ['dragon', 'flying'], ['outrage', 'earthquake', 'fire-punch', 'extreme-speed'], 'Multiscale'),
      fakeSet('Togekiss', ['fairy', 'flying'], ['air-slash', 'moonblast', 'flamethrower', 'roost'], 'Serene Grace'),
    ]
    const guest = [
      fakeSet('Blastoise', ['water'], ['surf', 'ice-beam', 'flash-cannon', 'protect'], 'Torrent'),
      fakeSet('Venusaur', ['grass', 'poison'], ['giga-drain', 'sludge-bomb', 'earthquake', 'protect'], 'Overgrow'),
      fakeSet('Tyranitar', ['rock', 'dark'], ['stone-edge', 'crunch', 'earthquake', 'ice-punch'], 'Sand Stream'),
      fakeSet('Garchomp', ['dragon', 'ground'], ['outrage', 'earthquake', 'stone-edge', 'fire-fang'], 'Rough Skin'),
      fakeSet('Scizor', ['bug', 'steel'], ['bullet-punch', 'u-turn', 'knock-off', 'swords-dance'], 'Technician'),
      fakeSet('Jellicent', ['water', 'ghost'], ['scald', 'shadow-ball', 'recover', 'will-o-wisp'], 'Water Absorb'),
    ]
    const started = Date.now()
    const result = await runSimulations({
      hostSets: host,
      guestSets: guest,
      hostName: 'host',
      guestName: 'guest',
      seed: [1, 2, 3, 4],
      typeChart,
      minBattles: 40,
      maxBattles: 40,
    })
    const elapsed = Date.now() - started
    assert.equal(result.played, 40)
    assert.equal(result.hostWins + result.guestWins + result.ties, 40)
    assert.ok(elapsed < 20000, `40 combats ont pris ${elapsed} ms`)
  })
})
