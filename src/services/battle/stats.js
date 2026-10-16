import { BATTLE_LEVEL, EV_EACH, IV_EACH } from './config.js'

const NATURE_BOOSTS = {
  adamant: { atk: 1.1, spa: 0.9 },
  modest: { spa: 1.1, atk: 0.9 },
  jolly: { spe: 1.1, spa: 0.9 },
  timid: { spe: 1.1, atk: 0.9 },
  brave: { atk: 1.1, spe: 0.9 },
  quiet: { spa: 1.1, spe: 0.9 },
  naughty: { atk: 1.1, spd: 0.9 },
  rash: { spa: 1.1, spd: 0.9 },
  lonely: { atk: 1.1, def: 0.9 },
  mild: { spa: 1.1, def: 0.9 },
  serious: {},
}

export function natureMultiplier(nature, stat) {
  return NATURE_BOOSTS[String(nature || '').toLowerCase()]?.[stat] || 1
}

export function calcStat(base, stat, { level = BATTLE_LEVEL, ev = EV_EACH, iv = IV_EACH, nature = 'serious' } = {}) {
  const evPart = Math.floor(ev / 4)
  if (stat === 'hp') {
    if (base === 1) return 1
    return Math.floor(((2 * base + iv + evPart) * level) / 100) + level + 10
  }
  const inner = Math.floor(((2 * base + iv + evPart) * level) / 100) + 5
  return Math.floor(inner * natureMultiplier(nature, stat))
}

export function baseStatsFromPokemon(pokemon) {
  const by = Object.fromEntries((pokemon?.stats || []).map((entry) => [entry.stat.name, entry.base_stat]))
  return {
    hp: by.hp || 0,
    atk: by.attack || 0,
    def: by.defense || 0,
    spa: by['special-attack'] || 0,
    spd: by['special-defense'] || 0,
    spe: by.speed || 0,
  }
}

export function pickNature(bases) {
  const physical = bases.atk >= bases.spa
  if (bases.spe >= bases.atk && bases.spe >= bases.spa) return physical ? 'jolly' : 'timid'
  return physical ? 'adamant' : 'modest'
}

export function statsAtLevel(bases, nature) {
  return {
    hp: calcStat(bases.hp, 'hp', { nature }),
    atk: calcStat(bases.atk, 'atk', { nature }),
    def: calcStat(bases.def, 'def', { nature }),
    spa: calcStat(bases.spa, 'spa', { nature }),
    spd: calcStat(bases.spd, 'spd', { nature }),
    spe: calcStat(bases.spe, 'spe', { nature }),
  }
}

export function expectedDamage({
  level = BATTLE_LEVEL,
  power,
  attack,
  defense,
  stab = false,
  effectiveness = 1,
  roll = 0.925,
}) {
  if (!power || !attack || !defense) return 0
  const base =
    Math.floor(Math.floor(((Math.floor((2 * level) / 5) + 2) * power * attack) / defense) / 50) + 2
  return base * (stab ? 1.5 : 1) * effectiveness * roll
}

export function minDamage(args) {
  return expectedDamage({ ...args, roll: 0.85 })
}
