import { WILSON_Z } from './config.js'

export function wilsonInterval(wins, n, z = WILSON_Z) {
  if (!n) return { lo: 0, hi: 1, p: 0.5 }
  const p = wins / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  return {
    p,
    lo: (center - margin) / denom,
    hi: (center + margin) / denom,
  }
}

export function shouldStop(hostWins, guestWins, playedDecisive, { minBattles, maxBattles }) {
  if (playedDecisive < minBattles) return false
  const interval = wilsonInterval(hostWins, playedDecisive)
  if (interval.lo > 0.5 || interval.hi < 0.5) return true
  return playedDecisive >= maxBattles
}

export function verdictOf(interval, hostWins, guestWins) {
  if (!interval) return 'close'
  if (interval.lo > 0.5) return 'host'
  if (interval.hi < 0.5) return 'guest'
  return 'close'
}

export function emptyPokemonStat(set) {
  return {
    species: set.species,
    name: set.name,
    slug: set.slug,
    kos: 0,
    sent: 0,
    damage: 0,
  }
}

export function mergePokemonStats(target, incoming) {
  for (const row of incoming || []) {
    const current = target.find((item) => item.species === row.species) || target.find((item) => item.slug === row.slug)
    if (!current) {
      target.push({ ...row })
      continue
    }
    current.kos += row.kos
    current.sent += row.sent
    current.damage += row.damage
  }
  return target
}

export function pickMvp(stats = []) {
  if (!stats.length) return null
  return [...stats].sort((a, b) => b.kos * 1000 + b.damage - (a.kos * 1000 + a.damage) || b.sent - a.sent)[0]
}

export function closenessScore(battle) {
  const hp = (battle.remainingHpHost || 0) + (battle.remainingHpGuest || 0)
  return Math.abs((battle.remainingHpHost || 0) - (battle.remainingHpGuest || 0)) + hp * 0.01 + (battle.turns || 0) * 0.001
}

export function keepRecaps(existing, battle) {
  const next = { ...(existing || {}) }
  if (battle.winner === 'host' && !next.hostWin) next.hostWin = battle
  if (battle.winner === 'guest' && !next.guestWin) next.guestWin = battle
  if (battle.winner !== 'tie') {
    if (!next.closest || closenessScore(battle) < closenessScore(next.closest)) next.closest = battle
  }
  return next
}
