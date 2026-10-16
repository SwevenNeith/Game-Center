import { BattleStreams, PRNG } from '@pkmn/sim'
import { SmartPlayer } from './ai.js'
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
import { sanitizeSetForSim, Teams, toPackedTeam } from './showdownIds.js'

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

export async function runOneBattle({
  hostSets,
  guestSets,
  hostName = 'host',
  guestName = 'guest',
  seed,
  typeChart,
  prepared,
}) {
  const teams = prepared || prepareTeams(hostSets, guestSets)
  const { p1sets, p2sets, packed1, packed2 } = teams

  const stream = new BattleStreams.BattleStream({ keepAlive: false })
  const streams = BattleStreams.getPlayerStreams(stream)
  const p1 = new SmartPlayer(streams.p1, {
    mySets: p1sets,
    theirSets: p2sets,
    typeChart,
    sideId: 'p1',
  })
  const p2 = new SmartPlayer(streams.p2, {
    mySets: p2sets,
    theirSets: p1sets,
    typeChart,
    sideId: 'p2',
  })
  void p1.start()
  void p2.start()

  const spec = { formatid: FORMAT_ID, seed: Array.isArray(seed) ? seed : seedFor(seed, 0) }
  const chunks = []
  await streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify({ name: hostName, team: packed1 })}\n>player p2 ${JSON.stringify({ name: guestName, team: packed2 })}`,
  )

  for await (const chunk of streams.omniscient) {
    chunks.push(chunk)
    if (chunk.includes('|turn|')) {
      const turns = chunk.match(/\|turn\|(\d+)/g)
      if (turns) {
        const turn = Number(turns[turns.length - 1].slice(6))
        if (turn >= MAX_TURNS) await streams.omniscient.write('>forcetie')
      }
    }
    if (chunk.includes('|win|') || chunk.includes('|tie|')) break
  }

  const log = chunks.join('\n')
  const parsed = parseBattleLog(log, { hostSets: p1sets, guestSets: p2sets })
  let winner = parsed.winner
  if (winner === hostName) winner = 'host'
  if (winner === guestName) winner = 'guest'
  if (winner !== 'host' && winner !== 'guest') {
    if (log.includes(`|win|${hostName}`)) winner = 'host'
    else if (log.includes(`|win|${guestName}`)) winner = 'guest'
    else winner = 'tie'
  }

  return {
    winner,
    turns: parsed.turns,
    hostStats: parsed.hostStats,
    guestStats: parsed.guestStats,
    remainingHpHost: parsed.remainingHpHost,
    remainingHpGuest: parsed.remainingHpGuest,
    recap: frenchRecap(parsed),
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
  const waveSize = Math.max(1, Number(concurrency) || SIM_CONCURRENCY)

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
      progress: Math.min(100, Math.round((played / maxBattles) * 100)),
    })
  }

  while (played < maxBattles) {
    const remaining = Math.min(waveSize, maxBattles - played)
    const jobs = Array.from({ length: remaining }, (_, offset) =>
      runOneBattle({
        hostSets,
        guestSets,
        hostName,
        guestName,
        seed: seedFor(seed, played + offset),
        typeChart,
        prepared,
      }),
    )
    const battles = await Promise.all(jobs)
    for (const battle of battles) {
      played += 1
      turnSum += battle.turns || 0
      if (battle.winner === 'host') hostWins += 1
      else if (battle.winner === 'guest') guestWins += 1
      else ties += 1
      mergePokemonStats(hostStats, battle.hostStats)
      mergePokemonStats(guestStats, battle.guestStats)
      recaps = keepRecaps(recaps, battle)
      emitProgress()
    }
    const decisive = hostWins + guestWins
    if (shouldStop(hostWins, guestWins, decisive, { minBattles, maxBattles })) break
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
