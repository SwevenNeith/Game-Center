import { BattleStreams } from '@pkmn/sim'
import { ALLOW_TERA } from './config.js'
import { expectedDamage, minDamage } from './stats.js'
import { typeEffectiveness } from './typeMatchup.js'
import { toID } from './showdownIds.js'

function parseHp(condition) {
  if (!condition || String(condition).includes('fnt')) return { hp: 0, max: 1, fainted: true }
  const match = String(condition).match(/(\d+)(?:\/(\d+))?/)
  if (!match) return { hp: 1, max: 1, fainted: false }
  const hp = Number(match[1])
  const max = Number(match[2] || match[1]) || 1
  return { hp, max, fainted: hp <= 0 }
}

function setByIdent(sets, pokemon) {
  const details = String(pokemon?.details || '').split(',')[0].trim()
  const speciesId = toID(details)
  return (
    (sets || []).find((set) => toID(set.species) === speciesId) ||
    (sets || []).find((set) => toID(set.slug) === speciesId) ||
    (sets || []).find((set) => pokemon?.ident && String(pokemon.ident).endsWith(set.species))
  )
}

function typesOf(set, fallback = []) {
  return (set?.types || []).map((type) => type.slug || type).filter(Boolean).length
    ? (set.types || []).map((type) => type.slug || type)
    : fallback
}

function moveById(set, moveIdOrName) {
  const id = toID(moveIdOrName)
  return (set?.moves || []).find((move) => toID(move.slug) === id || toID(move.showdown) === id)
}

function bestHit(attackerSet, attackerStats, defenderSet, defenderHp, typeChart, availableMoves) {
  let best = { damage: 0, min: 0, move: null, slot: 1, priority: 0, accuracy: 100 }
  for (const entry of availableMoves || []) {
    if (entry.disabled) continue
    const info = moveById(attackerSet, entry.id || entry.move) || {
      slug: entry.id || toID(entry.move),
      type: '',
      power: 0,
      classSlug: 'status',
      priority: 0,
      accuracy: 100,
    }
    if (!info.power || info.classSlug === 'status') continue
    const atk = info.classSlug === 'physical' ? attackerStats.atk : attackerStats.spa
    const def = info.classSlug === 'physical' ? defenderSet?.stats?.def : defenderSet?.stats?.spd
    const stab = typesOf(attackerSet).includes(info.type)
    const effectiveness = typeEffectiveness(typeChart, info.type, typesOf(defenderSet))
    const args = {
      power: info.power,
      attack: atk || 1,
      defense: def || 1,
      stab,
      effectiveness,
    }
    const damage = expectedDamage(args)
    if (damage > best.damage) {
      best = {
        damage,
        min: minDamage(args),
        move: info,
        slot: entry.slot,
        priority: info.priority || 0,
        accuracy: info.accuracy || 100,
      }
    }
  }
  return best
}

function statusMoveChoice(activeMoves, foe, selfHpRatio, boosts) {
  const ids = activeMoves.filter((entry) => !entry.disabled).map((entry) => ({
    ...entry,
    id: toID(entry.id || entry.move),
  }))
  const has = (id) => ids.find((entry) => entry.id === id)
  if (selfHpRatio <= 0.4) {
    const heal = ids.find((entry) =>
      ['recover', 'softboiled', 'roost', 'moonlight', 'morningsun', 'synthesis', 'shoreup', 'slackoff', 'milkdrink'].includes(
        entry.id,
      ),
    )
    if (heal) return heal
  }
  if (selfHpRatio > 0.6 && !(boosts?.atk > 0 || boosts?.spa > 0 || boosts?.spe > 0)) {
    const boost = ids.find((entry) =>
      ['swordsdance', 'nastyplot', 'calmmind', 'dragondance', 'quiverdance', 'bulkup'].includes(entry.id),
    )
    if (boost) return boost
  }
  if (!foe?.status) {
    const status = ids.find((entry) =>
      ['willowisp', 'thunderwave', 'toxic', 'spore', 'sleeppowder', 'stunspore', 'glare', 'nuzzle'].includes(entry.id),
    )
    if (status) return status
  }
  return has('protect') || has('detect') || null
}

function legalSwitches(request) {
  const pokemon = request.side?.pokemon || []
  const activeIndex = pokemon.findIndex((mon) => mon.active)
  return pokemon
    .map((mon, index) => ({ mon, slot: index + 1 }))
    .filter(({ mon, slot }) => {
      if (!mon) return false
      if (parseHp(mon.condition).fainted) return false
      if (mon.active && slot === activeIndex + 1) return false
      return !mon.active
    })
}

function matchupScore(mySet, myMon, foeSet, foe, typeChart) {
  if (!mySet || !foeSet) return 0
  const myMoves = (mySet.moves || []).map((move, index) => ({
    slot: index + 1,
    move: move.name,
    id: move.slug,
    disabled: false,
  }))
  const foeMoves = (foeSet.moves || []).map((move, index) => ({
    slot: index + 1,
    move: move.name,
    id: move.slug,
    disabled: false,
  }))
  const outgoing = bestHit(mySet, mySet.stats || myMon?.stats, foeSet, foe?.hp, typeChart, myMoves)
  const incoming = bestHit(foeSet, foeSet.stats, mySet, parseHp(myMon?.condition).hp, typeChart, foeMoves)
  const mySpe = mySet.stats?.spe || myMon?.stats?.spe || 0
  const foeSpe = foeSet.stats?.spe || 0
  const myHp = parseHp(myMon?.condition).hp
  const foeHp = foe?.hp || foeSet.stats?.hp || 1
  let score = outgoing.damage / Math.max(1, incoming.damage)
  if (outgoing.min >= foeHp) score += mySpe >= foeSpe || outgoing.priority > 0 ? 8 : 3
  if (incoming.min >= myHp && foeSpe > mySpe && outgoing.priority <= 0) score -= 6
  return score
}

export function pickLead(request, ctx) {
  const pokemon = request.side?.pokemon || []
  let bestSlot = 1
  let best = -Infinity
  for (let i = 0; i < pokemon.length; i += 1) {
    const set = setByIdent(ctx.mySets, pokemon[i])
    let total = 0
    for (const foeSet of ctx.theirSets || []) {
      total += matchupScore(set, pokemon[i], foeSet, { hp: foeSet.stats?.hp }, ctx.typeChart)
    }
    if (total > best) {
      best = total
      bestSlot = i + 1
    }
  }
  if (bestSlot === 1) return 'default'
  const rest = [1, 2, 3, 4, 5, 6].filter((slot) => slot !== bestSlot && slot <= pokemon.length)
  return `team ${bestSlot}${rest.join('')}`
}

export function pickForceSwitch(request, ctx) {
  const chosen = []
  const choices = (request.forceSwitch || []).map((mustSwitch) => {
    if (!mustSwitch) return 'pass'
    const options = legalSwitches(request).filter((entry) => !chosen.includes(entry.slot))
    if (!options.length) return 'pass'
    let best = options[0]
    let bestScore = -Infinity
    for (const option of options) {
      const set = setByIdent(ctx.mySets, option.mon)
      const score = matchupScore(set, option.mon, ctx.foeSet, ctx.foe, ctx.typeChart)
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    chosen.push(best.slot)
    return `switch ${best.slot}`
  })
  return choices.join(', ')
}

export function pickMoveOrSwitch(request, ctx) {
  const active = request.active?.[0]
  const pokemon = request.side?.pokemon || []
  const self = pokemon.find((mon) => mon.active) || pokemon[0]
  if (!active || !self || parseHp(self.condition).fainted) return 'pass'

  const moves = (active.moves || []).map((entry, index) => ({
    ...entry,
    slot: index + 1,
    disabled: Boolean(entry.disabled),
  }))
  const legalMoves = moves.filter((entry) => !entry.disabled)
  if (!legalMoves.length && active.trapped) return 'move 1'
  const mySet = setByIdent(ctx.mySets, self)
  const foeSet = ctx.foeSet
  const hp = parseHp(self.condition)
  const hit = bestHit(mySet, self.stats || mySet?.stats, foeSet, ctx.foe?.hp, ctx.typeChart, legalMoves)
  const foeMoves = (foeSet?.moves || []).map((move, index) => ({
    slot: index + 1,
    move: move.name,
    id: move.slug,
    disabled: false,
  }))
  const incoming = bestHit(foeSet, foeSet?.stats, mySet, hp.hp, ctx.typeChart, foeMoves)
  const mySpe = self.stats?.spe || mySet?.stats?.spe || 0
  const foeSpe = foeSet?.stats?.spe || 0
  const canKoFirst =
    hit.min >= (ctx.foe?.hp || 1) && (hit.priority > 0 || mySpe >= foeSpe || incoming.min < hp.hp)
  const wouldBeKoedFirst = incoming.min >= hp.hp && foeSpe > mySpe && hit.priority <= 0 && hit.min < (ctx.foe?.hp || 1)

  const switches = active.trapped ? [] : legalSwitches(request)
  const currentScore = matchupScore(mySet, self, foeSet, ctx.foe, ctx.typeChart)
  let bestSwitch = null
  let bestSwitchScore = currentScore + 0.8
  for (const option of switches) {
    const set = setByIdent(ctx.mySets, option.mon)
    const score = matchupScore(set, option.mon, foeSet, ctx.foe, ctx.typeChart)
    if (score > bestSwitchScore) {
      bestSwitchScore = score
      bestSwitch = option
    }
  }

  const tooManySwitches = (ctx.switchesInRow || 0) >= 2
  if (!canKoFirst && bestSwitch && (wouldBeKoedFirst || currentScore < 0.45) && !tooManySwitches) {
    return `switch ${bestSwitch.slot}`
  }

  const selfRatio = hp.hp / hp.max
  const support = statusMoveChoice(legalMoves, ctx.foe, selfRatio, ctx.boosts)
  if (support && !canKoFirst) {
    const id = toID(support.id || support.move)
    if (['protect', 'detect', 'spikyshield', 'banefulbunker', 'silktrap'].includes(id)) {
      if (incoming.damage > hp.hp * 0.45 && ctx.lastProtectTurn !== ctx.turn) {
        return `move ${support.slot}`
      }
    } else if (hit.damage < hp.max * 0.18 || selfRatio <= 0.4) {
      return `move ${support.slot}`
    }
  }

  if (hit.move) return `move ${hit.slot}`
  if (legalMoves[0]) return `move ${legalMoves[0].slot}`
  if (bestSwitch) return `switch ${bestSwitch.slot}`
  return 'move 1'
}

export function pickAction(request, ctx) {
  if (!request || request.wait) return null
  if (request.teamPreview) return pickLead(request, ctx)
  if (request.forceSwitch) return pickForceSwitch(request, ctx)
  if (request.active) return pickMoveOrSwitch(request, ctx)
  return null
}

export class SmartPlayer extends BattleStreams.BattlePlayer {
  constructor(playerStream, options = {}) {
    super(playerStream, Boolean(options.debug))
    this.mySets = options.mySets || []
    this.theirSets = options.theirSets || []
    this.typeChart = options.typeChart || {}
    this.sideId = options.sideId || 'p1'
    this.foe = { species: '', hp: 1, max: 1, status: '' }
    this.foeSet = options.theirSets?.[0] || null
    this.switchesInRow = 0
    this.lastProtectTurn = -1
    this.turn = 0
    this.lastRequest = null
    this.lastChoice = ''
  }

  receiveError(error) {
    if (String(error.message || '').startsWith('[Unavailable choice]') && this.lastRequest) {
      const fallback = this.safeFallback(this.lastRequest)
      if (fallback) this.choose(fallback)
      return
    }
    if (this.lastRequest) {
      const fallback = this.safeFallback(this.lastRequest)
      if (fallback) this.choose(fallback)
    }
  }

  receiveLine(line) {
    if (line.startsWith('|turn|')) this.turn = Number(line.slice(6)) || this.turn + 1
    const switchMatch = line.match(/\|switch\|(p[12])a: ([^|]+)\|([^,|]+)/)
    if (switchMatch) {
      const side = switchMatch[1]
      const species = switchMatch[3].trim()
      if (side !== this.sideId) {
        this.foe.species = species
        this.foeSet =
          this.theirSets.find((set) => toID(set.species) === toID(species)) ||
          this.theirSets.find((set) => toID(set.slug) === toID(species)) ||
          this.foeSet
      }
    }
    const hpMatch = line.match(/\|(?:-damage|-heal)\|(p[12])a: [^|]+\|(\d+)\/(\d+)/)
    if (hpMatch && hpMatch[1] !== this.sideId) {
      this.foe.hp = Number(hpMatch[2])
      this.foe.max = Number(hpMatch[3])
    }
    const startHp = line.match(/\|switch\|(p[12])a: [^|]+\|[^|]+\|(\d+)\/(\d+)/)
    if (startHp && startHp[1] !== this.sideId) {
      this.foe.hp = Number(startHp[2])
      this.foe.max = Number(startHp[3])
    }
    const status = line.match(/\|-status\|(p[12])a: [^|]+\|([^|]+)/)
    if (status && status[1] !== this.sideId) this.foe.status = status[2]
    const cure = line.match(/\|-curestatus\|(p[12])a: /)
    if (cure && line.includes(`${this.sideId === 'p1' ? 'p2' : 'p1'}a:`)) this.foe.status = ''
    super.receiveLine(line)
  }

  receiveRequest(request) {
    this.lastRequest = request
    const choice = pickAction(request, {
      mySets: this.mySets,
      theirSets: this.theirSets,
      typeChart: this.typeChart,
      foe: this.foe,
      foeSet: this.foeSet,
      switchesInRow: this.switchesInRow,
      lastProtectTurn: this.lastProtectTurn,
      turn: this.turn,
    })
    if (!choice) return
    if (choice.startsWith('switch')) this.switchesInRow += 1
    else this.switchesInRow = 0
    if (choice.includes('move') && /protect|detect/.test(choice) === false) {
      /* keep */
    }
    const moveName = request.active?.[0]?.moves?.[Number(choice.replace(/\D/g, '')) - 1]
    if (moveName && ['protect', 'detect'].includes(toID(moveName.id || moveName.move))) {
      this.lastProtectTurn = this.turn
    }
    this.lastChoice = choice
    this.choose(choice)
  }

  safeFallback(request) {
    if (request.forceSwitch) {
      const option = legalSwitches(request)[0]
      return option ? `switch ${option.slot}` : 'pass'
    }
    if (request.teamPreview) return 'default'
    const move = request.active?.[0]?.moves?.findIndex((entry) => !entry.disabled)
    if (move >= 0) return `move ${move + 1}`
    const option = legalSwitches(request)[0]
    return option ? `switch ${option.slot}` : 'move 1'
  }
}

export { ALLOW_TERA }
