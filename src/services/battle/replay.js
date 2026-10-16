import { generateTeamSets } from './sets.js'
import { getFinalEvolutions } from './evolutions.js'
import { loadTypeChart } from './typeMatchup.js'
import { makeSeed } from './config.js'
import { runBattleCampaign } from './runner.js'

function pickFinal(evo, fallback) {
  return evo?.auto || evo?.options?.find((option) => option.isDefault) || evo?.options?.[0] || fallback
}

function alreadyFinal(member) {
  return Boolean(member?.fromId && (member.pokemonId || member.id) && member.fromId !== (member.pokemonId || member.id))
}

export async function resolveTeamForDisplay(team) {
  const result = []
  for (const member of team || []) {
    if (alreadyFinal(member) || member?.pokemonId) {
      const id = member.pokemonId || member.id
      result.push({
        ...member,
        id,
        pokemonId: id,
        fr: member.fr || member.name || member.en || '',
      })
      continue
    }
    const fromId = member?.id || member?.pokemonId
    let chosen = {
      ...member,
      fromId,
      id: fromId,
      fr: member?.fr || member?.en || member?.name || '',
    }
    try {
      const evo = await getFinalEvolutions(fromId || member?.slug)
      const option = pickFinal(evo, chosen)
      chosen = {
        ...member,
        fromId,
        id: option.pokemonId || fromId,
        pokemonId: option.pokemonId || fromId,
        slug: option.slug || member.slug,
        fr: option.name || chosen.fr,
      }
    } catch {
      // on garde le Pokémon d’origine
    }
    result.push(chosen)
  }
  return result
}

async function setsForSavedTeam(team) {
  const finals = await resolveTeamForDisplay(team)
  return generateTeamSets(
    finals.map((member) => ({
      fromId: member.fromId || member.id,
      pokemonId: member.pokemonId || member.id,
      slug: member.slug,
      name: member.fr || member.en || member.name,
    })),
  )
}

export async function replaySavedTeams({ hostTeam, guestTeam, hostName, guestName, onProgress }) {
  const typeChart = await loadTypeChart()
  const hostSets = await setsForSavedTeam(hostTeam)
  const guestSets = await setsForSavedTeam(guestTeam)
  const results = await runBattleCampaign(
    {
      hostSets,
      guestSets,
      hostName: hostName || 'host',
      guestName: guestName || 'guest',
      seed: makeSeed(),
      typeChart,
    },
    onProgress,
  )
  return { ...results, status: 'done', progress: 100 }
}
