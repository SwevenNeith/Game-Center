import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldStop, wilsonInterval } from './results.js'

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
