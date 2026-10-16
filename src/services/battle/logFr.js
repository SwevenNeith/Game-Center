import { toID } from './showdownIds.js'

function nameOf(sets, ident, fallback) {
  const nick = String(ident || '').split(': ').pop()
  const found =
    (sets || []).find((set) => set.species === nick || set.name === nick) ||
    (sets || []).find((set) => toID(set.species) === toID(nick))
  return found?.name || fallback || nick
}

function moveName(sets, move, ident) {
  const set = (sets || []).find((item) => ident && String(ident).includes(item.species))
  const found = (set?.moves || []).find((entry) => entry.showdown === move || entry.name === move || toID(entry.slug) === toID(move))
  if (found) return found.name
  for (const item of sets || []) {
    const match = (item.moves || []).find((entry) => toID(entry.slug) === toID(move) || entry.showdown === move)
    if (match) return match.name
  }
  return move
}

export function parseBattleLog(rawLog, { hostSets, guestSets, keepEvents = true } = {}) {
  const lines = String(rawLog || '').split('\n')
  const events = []
  const hostStats = (hostSets || []).map((set) => ({
    species: set.species,
    name: set.name,
    slug: set.slug,
    kos: 0,
    sent: 0,
    damage: 0,
  }))
  const guestStats = (guestSets || []).map((set) => ({
    species: set.species,
    name: set.name,
    slug: set.slug,
    kos: 0,
    sent: 0,
    damage: 0,
  }))
  const hp = {}
  const maxHp = {}
  let winner = 'tie'
  let turns = 0
  let lastAttacker = null

  const statsOf = (side) => (side === 'p1' ? hostStats : guestStats)
  const bump = (side, species, field, amount = 1) => {
    const row =
      statsOf(side).find((item) => item.species === species) ||
      statsOf(side).find((item) => toID(item.species) === toID(species))
    if (row) row[field] += amount
  }

  for (const line of lines) {
    if (line.startsWith('|turn|')) {
      turns = Number(line.slice(6)) || turns + 1
      continue
    }
    const switchMatch = line.match(/\|switch\|(p[12])a: ([^|]+)\|([^,|]+)\|(\d+)\/(\d+)/)
    if (switchMatch) {
      const side = switchMatch[1]
      const species = switchMatch[3].trim()
      const ident = `${side}a`
      hp[ident] = Number(switchMatch[4])
      maxHp[ident] = Number(switchMatch[5])
      bump(side, species, 'sent')
      if (keepEvents) {
        const sets = side === 'p1' ? hostSets : guestSets
        events.push({
          kind: 'switch',
          text: `${nameOf(sets, switchMatch[2], species)} entre en combat.`,
          turn: turns,
        })
      }
      continue
    }
    const moveMatch = line.match(/\|move\|(p[12])a: ([^|]+)\|([^|]+)\|?(.*)?/)
    if (moveMatch) {
      lastAttacker = { side: moveMatch[1], ident: moveMatch[2], move: moveMatch[3] }
      if (keepEvents) {
        const sets = moveMatch[1] === 'p1' ? hostSets : guestSets
        events.push({
          kind: 'move',
          text: `${nameOf(sets, moveMatch[2])} utilise ${moveName(sets, moveMatch[3], moveMatch[2])}.`,
          turn: turns,
        })
      }
      continue
    }
    const dmg = line.match(/\|-damage\|(p[12])a: ([^|]+)\|(\d+)\/(\d+)/)
    if (dmg) {
      const ident = `${dmg[1]}a`
      const next = Number(dmg[3])
      const max = Number(dmg[4])
      const prev = hp[ident] ?? max
      const lost = Math.max(0, prev - next)
      const pct = max ? Math.round((lost / max) * 100) : 0
      hp[ident] = next
      maxHp[ident] = max
      if (lastAttacker && lastAttacker.side !== dmg[1]) {
        const atkSets = lastAttacker.side === 'p1' ? hostSets : guestSets
        const species = String(lastAttacker.ident).split(': ').pop()
        bump(lastAttacker.side, species, 'damage', lost)
        void atkSets
      }
      if (keepEvents && pct > 0) {
        events.push({
          kind: 'damage',
          text: `  → ${pct} % des PV.`,
          turn: turns,
        })
      }
      continue
    }
    const faint = line.match(/\|faint\|(p[12])a: ([^|]+)/)
    if (faint) {
      if (keepEvents) {
        const sets = faint[1] === 'p1' ? hostSets : guestSets
        events.push({
          kind: 'faint',
          text: `${nameOf(sets, faint[2])} est K.O.`,
          turn: turns,
        })
      }
      if (lastAttacker && lastAttacker.side !== faint[1]) {
        bump(lastAttacker.side, String(lastAttacker.ident).split(': ').pop(), 'kos')
      }
      continue
    }
    const win = line.match(/\|win\|(.+)/)
    if (win) {
      const name = win[1].trim()
      winner = name === 'host' || /hôte|hote/i.test(name) ? 'host' : name === 'guest' || /invit/i.test(name) ? 'guest' : name
      if (keepEvents) events.push({ kind: 'win', text: `Vainqueur : ${name}.`, turn: turns })
    }
    if (line.includes('|tie|') || line.includes('|tie')) {
      winner = 'tie'
      if (keepEvents) events.push({ kind: 'win', text: 'Match nul.', turn: turns })
    }
  }

  let remainingHpHost = 0
  let remainingHpGuest = 0
  for (const [ident, value] of Object.entries(hp)) {
    if (ident.startsWith('p1')) remainingHpHost += value
    if (ident.startsWith('p2')) remainingHpGuest += value
  }

  return {
    winner,
    turns,
    events,
    hostStats,
    guestStats,
    remainingHpHost,
    remainingHpGuest,
  }
}

export function frenchRecap(parsed) {
  return (parsed.events || []).map((event) => event.text)
}
