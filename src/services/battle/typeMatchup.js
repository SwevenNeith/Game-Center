import { TYPE_SLUGS } from './config.js'
import { fetchPoke, pickLocalizedName } from './pokeCache.js'

let chartPromise = null

export async function loadTypeChart() {
  if (chartPromise) return chartPromise
  chartPromise = (async () => {
    const chart = {}
    for (const slug of TYPE_SLUGS) {
      const data = await fetchPoke(`type/${slug}`)
      chart[slug] = {
        slug,
        name: pickLocalizedName(data.names, slug),
        double: (data.damage_relations?.double_damage_to || []).map((entry) => entry.name),
        half: (data.damage_relations?.half_damage_to || []).map((entry) => entry.name),
        none: (data.damage_relations?.no_damage_to || []).map((entry) => entry.name),
      }
    }
    return chart
  })()
  try {
    return await chartPromise
  } catch (error) {
    chartPromise = null
    throw error
  }
}

export function typeEffectiveness(chart, attackSlug, defenseSlugs = []) {
  const rel = chart?.[attackSlug]
  if (!rel) return 1
  let multiplier = 1
  for (const defense of defenseSlugs) {
    if (rel.none.includes(defense)) return 0
    if (rel.double.includes(defense)) multiplier *= 2
    if (rel.half.includes(defense)) multiplier *= 0.5
  }
  return multiplier
}
