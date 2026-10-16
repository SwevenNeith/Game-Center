import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickAction } from './ai.js'

const fire = { slug: 'fire', name: 'Feu' }
const water = { slug: 'water', name: 'Eau' }
const grass = { slug: 'grass', name: 'Plante' }

const chart = {
  fire: { double: ['grass'], half: ['water', 'fire'], none: [] },
  water: { double: ['fire'], half: ['water', 'grass'], none: [] },
  grass: { double: ['water'], half: ['fire', 'grass'], none: [] },
}

function set(name, types, moves, stats) {
  return {
    species: name,
    slug: name.toLowerCase(),
    name,
    types,
    stats,
    moves: moves.map((move) => ({
      slug: move.slug,
      name: move.name,
      type: move.type,
      classSlug: 'special',
      power: move.power,
      accuracy: 100,
      priority: 0,
    })),
  }
}

const charizard = set(
  'Charizard',
  [fire],
  [{ slug: 'flamethrower', name: 'Lance-Flammes', type: 'fire', power: 90 }],
  { hp: 150, atk: 80, def: 80, spa: 120, spd: 80, spe: 100 },
)
const blastoise = set(
  'Blastoise',
  [water],
  [{ slug: 'surf', name: 'Surf', type: 'water', power: 90 }],
  { hp: 160, atk: 80, def: 100, spa: 110, spd: 100, spe: 80 },
)
const venusaur = set(
  'Venusaur',
  [grass],
  [{ slug: 'gigadrain', name: 'Giga-Sangsue', type: 'grass', power: 75 }],
  { hp: 160, atk: 80, def: 90, spa: 110, spd: 100, spe: 80 },
)

describe('IA de changement', () => {
  it('change un Pokémon Feu mal matché contre un Eau s’il a un meilleur remplaçant', () => {
    const request = {
      active: [
        {
          moves: [{ move: 'Flamethrower', id: 'flamethrower', disabled: false }],
          trapped: false,
        },
      ],
      side: {
        pokemon: [
          {
            ident: 'p1: Charizard',
            details: 'Charizard, L50',
            condition: '150/150',
            active: true,
            stats: charizard.stats,
          },
          {
            ident: 'p1: Venusaur',
            details: 'Venusaur, L50',
            condition: '160/160',
            active: false,
            stats: venusaur.stats,
          },
        ],
      },
    }
    const choice = pickAction(request, {
      mySets: [charizard, venusaur],
      theirSets: [blastoise],
      typeChart: chart,
      foe: { species: 'Blastoise', hp: 160, max: 160, status: '' },
      foeSet: blastoise,
      switchesInRow: 0,
      turn: 2,
    })
    assert.equal(choice, 'switch 2')
  })

  it('attaque si le KO est possible avant d’être KO', () => {
    const weakFoe = {
      ...blastoise,
      stats: { ...blastoise.stats, hp: 10, spe: 10 },
    }
    const request = {
      active: [
        {
          moves: [{ move: 'Flamethrower', id: 'flamethrower', disabled: false }],
          trapped: false,
        },
      ],
      side: {
        pokemon: [
          {
            ident: 'p1: Charizard',
            details: 'Charizard, L50',
            condition: '150/150',
            active: true,
            stats: charizard.stats,
          },
        ],
      },
    }
    const choice = pickAction(request, {
      mySets: [charizard],
      theirSets: [weakFoe],
      typeChart: chart,
      foe: { species: 'Blastoise', hp: 10, max: 160, status: '' },
      foeSet: weakFoe,
      switchesInRow: 0,
      turn: 2,
    })
    assert.equal(choice, 'move 1')
  })
})
