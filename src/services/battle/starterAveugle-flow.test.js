import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  completeRound,
  emptyGameState,
  startCombatState,
  TOTAL_ROUNDS,
  withFinalChoice,
} from '../starterAveugle.js'

describe('fin du tirage', () => {
  it('passe aux évolutions finales après 6 manches', () => {
    const state = emptyGameState()
    state.status = 'picking'
    state.round = TOTAL_ROUNDS
    state.host.team = [1, 2, 3, 4, 5]
    state.guest.team = [6, 7, 8, 9, 10]
    const next = completeRound(state, 25, 133, [{ id: 25 }, { id: 133 }])
    assert.equal(next.status, 'evolve')
    assert.equal(next.host.team.length, 6)
    assert.equal(next.guest.team.length, 6)
    assert.equal(startCombatState({ ...next, status: 'teams' }).status, 'evolve')
  })

  it('verrouille un choix d’évolution déjà confirmé', () => {
    const state = emptyGameState()
    const first = withFinalChoice(state, 'host', 0, { pokemonId: 282, name: 'Gardevoir' })
    const again = withFinalChoice(first, 'host', 0, { pokemonId: 475, name: 'Gallame' })
    assert.equal(again.host.finalTeam[0].pokemonId, 282)
  })
})
