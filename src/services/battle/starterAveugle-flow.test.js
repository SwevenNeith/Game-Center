import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clearPlayerLie,
  completeRound,
  emptyGameState,
  restartGameState,
  startCombatState,
  TOTAL_ROUNDS,
  withFinalChoice,
  withLie,
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

describe('relance et mensonge', () => {
  it('efface le mensonge sans toucher aux propositions', () => {
    const state = emptyGameState()
    state.status = 'picking'
    state.host.proposals = [1, 4, 7]
    const withLieSet = withLie(state, 'host', 25, 4)
    assert.equal(withLieSet.host.lieId, 25)
    const cleared = clearPlayerLie(withLieSet, 'host')
    assert.equal(cleared.host.lieId, null)
    assert.deepEqual(cleared.host.proposals, [1, 4, 7])
  })

  it('reprend une partie info avec les mêmes joueurs', () => {
    const state = emptyGameState()
    state.status = 'done'
    state.host.playerName = 'Léa'
    state.guest.playerName = 'Tom'
    state.infoFlags.types = true
    state.host.team = [1, 2, 3, 4, 5, 6]
    state.battle.played = 40
    const next = restartGameState(state)
    assert.equal(next.status, 'info')
    assert.equal(next.host.playerName, 'Léa')
    assert.equal(next.guest.playerName, 'Tom')
    assert.equal(next.infoFlags.types, true)
    assert.deepEqual(next.host.team, [])
    assert.equal(next.battle.played, 0)
  })
})
