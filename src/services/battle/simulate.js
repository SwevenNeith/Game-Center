import { Battle, PRNG } from '@pkmn/sim'
import { pickAction } from './ai.js'
import { FORMAT_ID, MAX_BATTLES, MAX_TURNS, MIN_BATTLES, SIM_CONCURRENCY } from './config.js'
import { frenchRecap, parseBattleLog } from './logFr.js'
import {
  keepRecaps,
  mergePokemonStats,
  pickMvp,
  shouldStop,
  verdictOf,
  wilsonInterval,
} from './results.js'
import { sanitizeSetForSim, Teams, toID, toPackedTeam } from './showdownIds.js'

function seedFor(base, index) {
  if (Array.isArray(base) && base.length >= 4) {
    return [Number(base[0]) || 1, Number(base[1]) || 0, Number(base[2]) || 0, (Number(base[3]) || 0) + index]
  }
  const n = Number(base) || 1
  return [n, index + 1, (n * 17 + index) >>> 0, (n * 31) >>> 0]
}

function prepareTeams(hostSets, guestSets) {
  const p1sets = hostSets.map(sanitizeSetForSim)
  const p2sets = guestSets.map(sanitizeSetForSim)
  const packed1 = toPackedTeam(p1sets)
  const packed2 = toPackedTeam(p2sets)
  if (!Teams.unpack(packed1)?.length || !Teams.unpack(packed2)?.length) {
    throw new Error('Équipe Showdown invalide')
  }
  return { p1sets, p2sets, packed1, packed2 }
}

function setBySpecies(sets, species) {
  const id = toID(species)
  if (!id) return sets?.[0] || null
  return (
    (sets || []).find((set) => toID(set.species) === id) ||
    (sets || []).find((set) => toID(set.slug) === id) ||
    sets?.[0] ||
    null
  )
}

function pickForSide(side, ctx, ai) {
  const request = side.activeRequest
  if (!request || request.wait) return ''
  const foe = side.foe?.active?.[0]
  const species = foe?.species?.name || foe?.set?.species || ''
  const choice = pickAction(request, {
    mySets: ctx.mySets,
    theirSets: ctx.theirSets,
    typeChart: ctx.typeChart,
    foe: foe
      ? { hp: foe.hp, max: foe.maxhp || 1, status: String(foe.status || ''), species }
      : { hp: 1, max: 1, status: '', species: '' },
    foeSet: setBySpecies(ctx.theirSets, species),
    switchesInRow: ai.switchesInRow,
    lastProtectTurn: ai.lastProtectTurn,
    turn: side.battle?.turn || 0,
  })
  if (!choice) return 'default'
  if (choice.startsWith('switch')) ai.switchesInRow += 1
  else ai.switchesInRow = 0
  return choice
}

function advanceBattle(battle, c1, c2) {
  try {
    battle.makeChoices(c1, c2)
    return true
  } catch {
    try {
      battle.p1.clearChoice()
      battle.p2.clearChoice()
      battle.makeChoices()
      return true
    } catch {
      return false
    }
  }
}

export async function runOneBattle({
  hostSets,
  guestSets,
  hostName = 'host',
  guestName = 'guest',
  seed,
  typeChart,
  prepared,
  wantRecap = true,
}) {
  const teams = prepared || prepareTeams(hostSets, guestSets)
  const { p1sets, p2sets, packed1, packed2 } = teams
  const battle = new Battle({
    formatid: FORMAT_ID,
    seed: Array.isArray(seed) ? seed : seedFor(seed, 0),
    p1: { name: hostName, team: packed1 },
    p2: { name: guestName, team: packed2 },
  })

  const p1ai = { switchesInRow: 0, lastProtectTurn: -1 }
  const p2ai = { switchesInRow: 0, lastProtectTurn: -1 }
  const hostCtx = { mySets: p1sets, theirSets: p2sets, typeChart }
  const guestCtx = { mySets: p2sets, theirSets: p1sets, typeChart }
  const maxSteps = MAX_TURNS * 4 + 20

  try {
    for (let step = 0; step < maxSteps && !battle.ended; step += 1) {
      if (battle.turn >= MAX_TURNS) {
        battle.forceWin()
        break
      }
      const ok = advanceBattle(
        battle,
        pickForSide(battle.p1, hostCtx, p1ai),
        pickForSide(battle.p2, guestCtx, p2ai),
      )
      if (!ok) {
        battle.forceWin()
        break
      }
    }
    if (!battle.ended) battle.forceWin()

    const log = battle.getDebugLog()
    const parsed = parseBattleLog(log, { hostSets: p1sets, guestSets: p2sets, keepEvents: wantRecap })
    let winner = parsed.winner
    if (winner === hostName) winner = 'host'
    if (winner === guestName) winner = 'guest'
    if (winner !== 'host' && winner !== 'guest') {
      if (battle.winner === hostName) winner = 'host'
      else if (battle.winner === guestName) winner = 'guest'
      else winner = 'tie'
    }

    return {
      winner,
      turns: parsed.turns || battle.turn || 0,
      hostStats: parsed.hostStats,
      guestStats: parsed.guestStats,
      remainingHpHost: parsed.remainingHpHost,
      remainingHpGuest: parsed.remainingHpGuest,
      recap: wantRecap ? frenchRecap(parsed) : [],
    }
  } finally {
    battle.destroy()
  }
}

export async function runSimulations(options, onProgress) {
  const {
    hostSets,
    guestSets,
    hostName = 'host',
    guestName = 'guest',
    seed = 1,
    typeChart,
    minBattles = MIN_BATTLES,
    maxBattles = MAX_BATTLES,
    concurrency = SIM_CONCURRENCY,
  } = options

  const prepared = prepareTeams(hostSets, guestSets)
  let hostWins = 0
  let guestWins = 0
  let ties = 0
  let turnSum = 0
  let played = 0
  const hostStats = []
  const guestStats = []
  let recaps = {}
  const yieldEvery = Math.max(1, Number(concurrency) || 1)

  const progressPct = () => {
    if (played <= 0) return 0
    if (played < minBattles) return Math.round((played / minBattles) * 85)
    if (played >= maxBattles) return 100
    return Math.min(99, Math.round(85 + ((played - minBattles) / (maxBattles - minBattles)) * 14))
  }

  const emitProgress = () => {
    const decisive = hostWins + guestWins
    onProgress?.({
      played,
      hostWins,
      guestWins,
      ties,
      interval: wilsonInterval(hostWins, decisive),
      minBattles,
      maxBattles,
      progress: progressPct(),
    })
  }

  emitProgress()
  await Promise.resolve()

  for (let index = 0; index < maxBattles; index += 1) {
    const wantRecap = !recaps.hostWin || !recaps.guestWin || !recaps.closest
    const battle = await runOneBattle({
      hostSets,
      guestSets,
      hostName,
      guestName,
      seed: seedFor(seed, index),
      typeChart,
      prepared,
      wantRecap,
    })
    played += 1
    turnSum += battle.turns || 0
    if (battle.winner === 'host') hostWins += 1
    else if (battle.winner === 'guest') guestWins += 1
    else ties += 1
    mergePokemonStats(hostStats, battle.hostStats)
    mergePokemonStats(guestStats, battle.guestStats)
    recaps = keepRecaps(recaps, battle)
    emitProgress()
    const decisive = hostWins + guestWins
    if (shouldStop(hostWins, guestWins, decisive, { minBattles, maxBattles })) break
    if (index % yieldEvery === 0) await Promise.resolve()
  }

  const decisive = hostWins + guestWins
  const interval = wilsonInterval(hostWins, decisive)
  const verdict = verdictOf(interval, hostWins, guestWins)

  return {
    played,
    hostWins,
    guestWins,
    ties,
    avgTurns: played ? Math.round((turnSum / played) * 10) / 10 : 0,
    interval,
    verdict,
    hostWinRate: decisive ? hostWins / decisive : 0.5,
    guestWinRate: decisive ? guestWins / decisive : 0.5,
    hostStats,
    guestStats,
    hostMvp: pickMvp(hostStats),
    guestMvp: pickMvp(guestStats),
    recaps: {
      hostWin: recaps.hostWin
        ? { winner: 'host', turns: recaps.hostWin.turns, lines: recaps.hostWin.recap }
        : null,
      guestWin: recaps.guestWin
        ? { winner: 'guest', turns: recaps.guestWin.turns, lines: recaps.guestWin.recap }
        : null,
      closest: recaps.closest
        ? { winner: recaps.closest.winner, turns: recaps.closest.turns, lines: recaps.closest.recap }
        : null,
    },
  }
}

export { PRNG }
