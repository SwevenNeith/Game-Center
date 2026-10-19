import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseBattleLog } from './logFr.js'

function set(species) {
  return { species, name: species, slug: species.toLowerCase() }
}

describe('parseBattleLog', () => {
  it('compte les dégâts même quand le KO arrive en 0 fnt', () => {
    const log = [
      '|switch|p1a: Pikachu|Pikachu, L50|100/100',
      '|switch|p2a: Carapuce|Squirtle, L50|80/80',
      '|turn|1',
      '|move|p1a: Pikachu|Thunderbolt|p2a: Carapuce',
      '|-damage|p2a: Carapuce|20/80',
      '|move|p1a: Pikachu|Thunderbolt|p2a: Carapuce',
      '|-damage|p2a: Carapuce|0 fnt',
      '|faint|p2a: Carapuce',
      '|win|host',
    ].join('\n')

    const parsed = parseBattleLog(log, {
      hostSets: [set('Pikachu')],
      guestSets: [set('Squirtle')],
      keepEvents: false,
    })
    assert.equal(parsed.hostStats[0].kos, 1)
    assert.equal(parsed.hostStats[0].damage, 80)
    assert.equal(parsed.hostStats[0].sent, 1)
    assert.equal(parsed.guestStats[0].sent, 1)
  })

  it('compte un KO direct 0 fnt après l’envoi', () => {
    const log = [
      '|switch|p1a: Pikachu|Pikachu, L50, M|100/100',
      '|switch|p2a: Carapuce|Squirtle, L50, M|80/80',
      '|turn|1',
      '|move|p1a: Pikachu|Thunderbolt|p2a: Carapuce',
      '|-damage|p2a: Carapuce|0 fnt',
      '|faint|p2a: Carapuce',
      '|win|host',
    ].join('\n')
    const parsed = parseBattleLog(log, {
      hostSets: [set('Pikachu')],
      guestSets: [set('Squirtle')],
      keepEvents: false,
    })
    assert.equal(parsed.hostStats[0].kos, 1)
    assert.equal(parsed.hostStats[0].damage, 80)
  })
})
