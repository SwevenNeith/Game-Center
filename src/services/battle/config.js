/** Réglages du combat Starter à l’aveugle. Modifiables sans toucher au reste. */

export const BATTLE_LEVEL = 50
export const EV_EACH = 84
export const IV_EACH = 31

export const MIN_BATTLES = 40
export const MAX_BATTLES = 300
export const BATCH_SIZE = 20
/** Combats simultanés dans le worker (plus = plus rapide, plus de CPU). */
export const SIM_CONCURRENCY = 8
export const MAX_TURNS = 300
export const WILSON_Z = 1.96

/** Probabilité que le 4e slot soit un soutien si un bon soutien existe. */
export const SUPPORT_SLOT_CHANCE = 0.55

/** Ne pas terastalliser. */
export const ALLOW_TERA = false

/**
 * L’IA connaît les sets complets des deux équipes (stats, attaques, talent, objet).
 * Passe à true plus tard pour n’utiliser que ce que le simulateur révèle en combat.
 */
export const FOG_OF_WAR = false

export const FORMAT_ID = 'gen9customgame'

export const MAX_POKEAPI_PARALLEL = 4

/** Objets neutres (pas d’objets Choix). Noms PokéAPI ; FR + sprite via /item/{nom}. */
export const NEUTRAL_ITEMS = [
  'leftovers',
  'sitrus-berry',
  'lum-berry',
  'focus-sash',
  'rocky-helmet',
  'air-balloon',
  'covert-cloak',
  'loaded-dice',
  'punching-glove',
  'safety-goggles',
  'mental-herb',
  'white-herb',
  'expert-belt',
  'utility-umbrella',
  'clear-amulet',
  'mirror-herb',
]

export const BANNED_ABILITIES = new Set([
  'wonder-guard',
  'huge-power',
  'pure-power',
  'shadow-tag',
  'arena-trap',
  'magnet-pull',
  'moody',
  'parental-bond',
  'simple',
  'speed-boost',
  'contrary',
])

export const BANNED_ABILITY_IDS = new Set([
  'wonderguard',
  'hugepower',
  'purepower',
  'shadowtag',
  'arenatrap',
  'magnetpull',
  'moody',
  'parentalbond',
  'simple',
  'speedboost',
  'contrary',
  'libero',
  'protean',
])

export const BANNED_MOVE_IDS = new Set([
  'fissure',
  'horndrill',
  'guillotine',
  'sheercold',
  'explosion',
  'selfdestruct',
  'mistyexplosion',
  'memento',
  'healingwish',
  'lunardance',
  'finalgambit',
  'destinybond',
  'struggle',
])

export const SUPPORT_MOVE_IDS = new Set([
  'protect',
  'detect',
  'spikyshield',
  'banefulbunker',
  'silktrap',
  'recover',
  'softboiled',
  'roost',
  'moonlight',
  'morningsun',
  'synthesis',
  'shoreup',
  'slackoff',
  'milkdrink',
  'wish',
  'swordsdance',
  'nastyplot',
  'calmmind',
  'dragondance',
  'quiverdance',
  'bulkup',
  'irondefense',
  'cosmicpower',
  'willowisp',
  'thunderwave',
  'toxic',
  'spore',
  'sleeppowder',
  'stunspore',
  'nuzzle',
  'glare',
  'substitute',
  'encore',
  'taunt',
  'stealthrock',
  'spikes',
  'toxicspikes',
  'stickyweb',
  'rapidspin',
  'defog',
  'knockoff',
  'uturn',
  'voltswitch',
  'flipturn',
])

export const COSMETIC_VARIETY =
  /^(unown-|alcremie-|vivillon-|furfrou-|flabebe-|floette-(?!eternal)|florges-|deerling-|sawsbuck-|minior-(?!red(?:-meteor)?$)|squawkabilly-|tatsugiri-)/i

export const EXCLUDED_FORM = /-(mega|gmax|gigantamax|primal)(-|$)/i

export function makeSeed() {
  const bytes = crypto.getRandomValues(new Uint32Array(4))
  return [bytes[0] || 1, bytes[1] || 2, bytes[2] || 3, bytes[3] || 4]
}

export const TYPE_SLUGS = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]
