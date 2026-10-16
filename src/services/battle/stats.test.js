import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcStat, expectedDamage, pickNature, statsAtLevel } from './stats.js'

describe('stats niveau 50', () => {
  it('calcule les PV et une stat avec EV 84 / IV 31', () => {
    assert.equal(calcStat(35, 'hp'), 121)
    assert.ok(calcStat(55, 'atk', { nature: 'adamant' }) > calcStat(55, 'atk', { nature: 'modest' }))
  })

  it('choisit une nature offensive', () => {
    assert.equal(pickNature({ hp: 80, atk: 120, def: 80, spa: 70, spd: 80, spe: 60 }), 'adamant')
    assert.equal(pickNature({ hp: 80, atk: 50, def: 80, spa: 120, spd: 80, spe: 130 }), 'timid')
  })

  it('produit un bloc de stats cohérent', () => {
    const stats = statsAtLevel({ hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 }, 'modest')
    assert.ok(stats.hp > 140)
    assert.ok(stats.spa > stats.atk)
  })

  it('estime des dégâts STAB super efficaces', () => {
    const damage = expectedDamage({ power: 90, attack: 120, defense: 80, stab: true, effectiveness: 2 })
    assert.ok(damage > 80)
  })
})
