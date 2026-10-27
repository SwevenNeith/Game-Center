import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  beginCountdown,
  beginPlaying,
  bothReady,
  emptyWhosThatState,
  markPlayerFinished,
  recordPlayerRound,
  restartWhosThatState,
  withPlayerName,
  withReady,
} from './whosThatGame.js'

describe('état Who’s that Pokémon', () => {
  it('passe en lobby quand les deux noms sont là', () => {
    let state = emptyWhosThatState()
    state = withPlayerName(state, 'host', 'Léa')
    assert.equal(state.status, 'naming')
    state = withPlayerName(state, 'guest', 'Tom')
    assert.equal(state.status, 'lobby')
  })

  it('ne lance le compte à rebours que si les deux sont prêts', () => {
    let state = emptyWhosThatState()
    state.status = 'lobby'
    state.host.playerName = 'Léa'
    state.guest.playerName = 'Tom'
    state = withReady(state, 'host', true)
    assert.equal(bothReady(state), false)
    assert.equal(beginCountdown(state).status, 'lobby')
    state = withReady(state, 'guest', true)
    const next = beginCountdown(state)
    assert.equal(next.status, 'countdown')
    assert.ok(next.seed)
    assert.equal(beginPlaying(next).status, 'playing')
  })

  it('enregistre une manche sans toucher l’autre joueur', () => {
    let state = emptyWhosThatState()
    state = recordPlayerRound(
      state,
      'host',
      { id: 25, name: 'Pikachu', artworkUrl: 'x', guess: 'Pikachu', ok: true },
      { points: 1, correct: 1, wrong: 0 },
    )
    assert.equal(state.host.rounds.length, 1)
    assert.equal(state.guest.rounds.length, 0)
    const restarted = restartWhosThatState({ ...state, durationSeconds: 90, samePokemon: false })
    assert.equal(restarted.status, 'lobby')
    assert.equal(restarted.host.rounds.length, 0)
    assert.equal(restarted.durationSeconds, 90)
    assert.equal(restarted.samePokemon, false)
  })

  it('n’achève la partie duo que quand les deux chronos sont finis', () => {
    let state = emptyWhosThatState()
    state.status = 'playing'
    state = markPlayerFinished(state, 'host')
    assert.equal(state.status, 'playing')
    assert.equal(state.host.finished, true)
    assert.equal(state.guest.finished, false)
    state = markPlayerFinished(state, 'guest')
    assert.equal(state.status, 'done')
    assert.equal(state.guest.finished, true)
  })
})
