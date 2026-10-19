import { toID } from './showdownIds.js'

function nameOf(sets, ident, fallback) {
  const nick = String(ident || '').split(': ').pop()
  const found =
    (sets || []).find((set) => set.species === nick || set.name === nick) ||
    (sets || []).find((set) => toID(set.species) === toID(nick) || toID(set.slug) === toID(nick) || toID(set.name) === toID(nick))
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

function identKey(side, ident) {
  const nick = String(ident || '').split(': ').pop()
  return `${side}:${toID(nick)}`
}

function parseHpStatus(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  if (/^fnt\b/i.test(text) || /^0\b.*\bfnt\b/i.test(text)) {
    return { hp: 0, max: null, fainted: true }
  }
  const frac = text.match(/^(\d+)\s*\/\s*(\d+)/)
  if (frac) {
    const hp = Number(frac[1])
    const max = Number(frac[2])
    return { hp, max, fainted: hp <= 0 || /\bfnt\b/i.test(text) }
  }
  return null
}

function findStatRow(stats, ident, species) {
  const keys = [ident, species]
    .filter(Boolean)
    .map((value) => toID(String(value).split(': ').pop()))
  return (
    stats.find((item) => keys.includes(toID(item.species))) ||
    stats.find((item) => keys.includes(toID(item.slug))) ||
    stats.find((item) => keys.includes(toID(item.name))) ||
    null
  )
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
  const bump = (side, ident, field, amount = 1, species = '') => {
    const row = findStatRow(statsOf(side), ident, species)
    if (row) row[field] += amount
  }

  for (const line of lines) {
    if (line.startsWith('|turn|')) {
      turns = Number(line.slice(6)) || turns + 1
      continue
    }
    const switchMatch = line.match(/\|(?:switch|drag)\|(p[12])a: ([^|]+)\|([^|]+)\|([^|]*)/)
    if (switchMatch) {
      const side = switchMatch[1]
      const ident = switchMatch[2]
      const species = switchMatch[3].split(',')[0].trim()
      const parsed = parseHpStatus(switchMatch[4])
      const key = identKey(side, ident)
      if (parsed?.max) maxHp[key] = parsed.max
      hp[key] = parsed?.hp ?? parsed?.max ?? hp[key] ?? 0
      bump(side, ident, 'sent', 1, species)
      if (keepEvents) {
        const sets = side === 'p1' ? hostSets : guestSets
        events.push({
          kind: 'switch',
          text: `${nameOf(sets, ident, species)} entre en combat.`,
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
    const dmg = line.match(/\|-damage\|(p[12])a: ([^|]+)\|([^|]+)/)
    if (dmg) {
      const side = dmg[1]
      const ident = dmg[2]
      const key = identKey(side, ident)
      const parsed = parseHpStatus(dmg[3])
      if (parsed) {
        const prev = hp[key] ?? parsed.max ?? 0
        const lost = parsed.fainted ? Math.max(0, prev) : Math.max(0, prev - parsed.hp)
        if (parsed.max) maxHp[key] = parsed.max
        hp[key] = parsed.hp
        if (lastAttacker && lastAttacker.side !== side && lost > 0) {
          bump(lastAttacker.side, lastAttacker.ident, 'damage', lost)
        }
        if (keepEvents && parsed.max && lost > 0) {
          events.push({
            kind: 'damage',
            text: `  → ${Math.round((lost / parsed.max) * 100)} % des PV.`,
            turn: turns,
          })
        }
      }
      continue
    }
    const faint = line.match(/\|faint\|(p[12])a: ([^|]+)/)
    if (faint) {
      const side = faint[1]
      const ident = faint[2]
      const key = identKey(side, ident)
      const remaining = hp[key] ?? 0
      if (remaining > 0 && lastAttacker && lastAttacker.side !== side) {
        bump(lastAttacker.side, lastAttacker.ident, 'damage', remaining)
      }
      hp[key] = 0
      if (keepEvents) {
        const sets = side === 'p1' ? hostSets : guestSets
        events.push({
          kind: 'faint',
          text: `${nameOf(sets, ident)} est K.O.`,
          turn: turns,
        })
      }
      if (lastAttacker && lastAttacker.side !== side) {
        bump(lastAttacker.side, lastAttacker.ident, 'kos')
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
