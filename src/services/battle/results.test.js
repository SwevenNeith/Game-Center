import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickMvp, shouldStop, wilsonInterval } from './results.js'

describe('intervalle de Wilson', () => {
  it('exclut 50 % quand un côté domine', () => {
    const interval = wilsonInterval(35, 40)
    assert.ok(interval.lo > 0.5)
    assert.equal(shouldStop(35, 5, 40, { minBattles: 40, maxBattles: 300 }), true)
  })

  it('reste ouvert si c’est serré', () => {
    const interval = wilsonInterval(21, 40)
    assert.ok(interval.lo < 0.5)
    assert.ok(interval.hi > 0.5)
    assert.equal(shouldStop(21, 19, 40, { minBattles: 40, maxBattles: 300 }), false)
  })
})

describe('MVP', () => {
  it('choisit le Pokémon qui a mis le plus de dégâts', () => {
    const mvp = pickMvp([
      { name: 'Pikachu', kos: 8, damage: 120, sent: 0 },
      { name: 'Dracaufeu', kos: 2, damage: 900, sent: 0 },
      { name: 'Tortank', kos: 5, damage: 400, sent: 0 },
    ])
    assert.equal(mvp.name, 'Dracaufeu')
  })
})
