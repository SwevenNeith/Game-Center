import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  applyAnswer,
  artworkUrlFromPokemon,
  buildSoloResults,
  cacheGet,
  cacheSet,
  createMysterySession,
  describeLoadError,
  fetchMysteryById,
  formatClock,
  frozenRemaining,
  frenchNameFromSpecies,
  shiftedDeadline,
  isCorrectGuess,
  isExcludedMysteryId,
  officialPokemonName,
  playerAnswerLabel,
  loadMysteryPokemon,
  normalizeGuess,
  parseWhosThatResults,
  pickPokemonId,
  pokemonIdAt,
  resetMysteryCache,
  shuffledDeck,
  winnerLabel,
} from './whosThatPokemon.js'

afterEach(() => {
  resetMysteryCache()
})

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function pokemonPayload(id, artwork, home = null) {
  return {
    id,
    name: `poke-${id}`,
    sprites: {
      other: {
        'official-artwork': { front_default: artwork },
        home: { front_default: home },
      },
    },
  }
}

function speciesPayload(id, fr, en = `poke-${id}`) {
  return {
    names: [
      { name: en, language: { name: 'en' } },
      ...(fr ? [{ name: fr, language: { name: 'fr' } }] : []),
    ],
  }
}

function makeFetch(byId) {
  return async (url) => {
    const match = String(url).match(/\/(\d+)\/?$/)
    const id = Number(match?.[1])
    const record = byId(id, url)
    if (!record) return jsonResponse({}, 404)
    return jsonResponse(record)
  }
}

describe('pickPokemonId', () => {
  it('évite les numéros déjà vus', () => {
    const seen = [1, 2, 3, 4]
    for (let i = 0; i < 20; i += 1) {
      assert.equal(pickPokemonId(seen, 5), 5)
    }
  })

  it('repart de zéro quand tous sont passés', () => {
    const id = pickPokemonId([1, 2, 3], 3)
    assert.ok(id >= 1 && id <= 3)
  })

  it('n’inclut pas les Pokémon Paradoxe', () => {
    assert.equal(isExcludedMysteryId(984), true)
    assert.equal(isExcludedMysteryId(25), false)
    for (let i = 0; i < 40; i += 1) {
      const id = pickPokemonId([], 990)
      assert.equal(isExcludedMysteryId(id), false)
    }
  })
})

describe('tirage partagé', () => {
  it('donne la même série pour une même seed', () => {
    const first = shuffledDeck('abc', [1, 2, 3, 4, 5])
    const second = shuffledDeck('abc', [1, 2, 3, 4, 5])
    assert.deepEqual(first, second)
    assert.equal(pokemonIdAt('abc', 0, [1, 2, 3, 4, 5]), pokemonIdAt('abc', 0, [1, 2, 3, 4, 5]))
  })
})

describe('saisie du nom', () => {
  it('ignore casse, accents et ponctuation', () => {
    assert.equal(normalizeGuess('  Évoli  '), 'evoli')
    assert.equal(normalizeGuess('M. Mime'), 'mmime')
    assert.equal(normalizeGuess('Nidoran♀'), 'nidoranf')
    assert.equal(isCorrectGuess('evoli', { name: 'Évoli', nameEn: 'Eevee' }), true)
    assert.equal(isCorrectGuess('Eevee', { name: 'Évoli', nameEn: 'Eevee' }), true)
    assert.equal(isCorrectGuess('Pikachu', { name: 'Évoli', nameEn: 'Eevee' }), false)
    assert.equal(isCorrectGuess('   ', { name: 'Pikachu' }), false)
  })

  it('compte un point si c’est juste, zéro si c’est faux', () => {
    const ok = applyAnswer({ points: 2, correct: 2, wrong: 1 }, true)
    assert.deepEqual(ok, { points: 3, correct: 3, wrong: 1 })
    const ko = applyAnswer(ok, false)
    assert.deepEqual(ko, { points: 3, correct: 3, wrong: 2 })
  })

  it('ne décompte pas le temps pendant une pause de révélation', () => {
    assert.equal(frozenRemaining(10_000, 4_000), 6_000)
    assert.equal(frozenRemaining(10_000, 5_000, 4_000), 6_000)
    assert.equal(shiftedDeadline(10_000, 4_000, 5_000), 11_000)
    assert.equal(frozenRemaining(11_000, 5_000), 6_000)
  })

  it('formate le chrono et un résultat solo', () => {
    assert.equal(formatClock(90_000), '1:30')
    assert.equal(formatClock(500), '0:01')
    const results = buildSoloResults({
      durationSeconds: 60,
      stats: { points: 4, correct: 4, wrong: 2 },
    })
    assert.equal(results.winner, 'solo')
    assert.equal(results.guest.pending, true)
    assert.equal(parseWhosThatResults(results).host.points, 4)
    assert.equal(winnerLabel(results, 'Léa', 'Adversaire'), 'Partie solo')
  })

  it('affiche le nom officiel du Pokémon, pas seulement la saisie', () => {
    assert.equal(officialPokemonName({ id: 25, name: 'Pikachu', guess: 'pikachu', ok: true }), 'Pikachu')
    assert.equal(officialPokemonName({ id: 25, name: 'Pikachu', guess: 'Raichu', ok: false }), 'Pikachu')
    assert.equal(officialPokemonName({ id: 25, name: 'Pikachu', skipped: true }), 'Pikachu')
    assert.equal(playerAnswerLabel({ name: 'Pikachu', guess: 'Pikachu', ok: true }), 'Trouvé')
    assert.equal(playerAnswerLabel({ name: 'Pikachu', guess: 'Raichu', ok: false }), 'Raichu')
    assert.equal(playerAnswerLabel({ name: 'Pikachu', skipped: true }), 'Passé')
    assert.equal(playerAnswerLabel(null), '—')
    assert.equal(
      winnerLabel({ winner: 'guest', guest: { pending: false } }, 'Léa', 'Cam'),
      'Cam l’emporte',
    )
    assert.equal(
      winnerLabel(
        { winner: 'guest', host: { points: 2 }, guest: { pending: false, points: 4 } },
        'Local',
        'Cam',
      ),
      'Cam l’emporte avec 4 points',
    )
  })
})

describe('noms et artwork', () => {
  it('prend le nom français, sinon l’anglais', () => {
    assert.equal(frenchNameFromSpecies(speciesPayload(25, 'Pikachu'), 'fallback'), 'Pikachu')
    assert.equal(frenchNameFromSpecies(speciesPayload(1, '', 'Bulbasaur'), 'x'), 'Bulbasaur')
    assert.equal(frenchNameFromSpecies({ names: [] }, 'Bulbizarre'), 'Bulbizarre')
  })

  it('prend l’artwork officiel, sinon home', () => {
    assert.equal(
      artworkUrlFromPokemon(pokemonPayload(1, 'official.png', 'home.png')),
      'official.png',
    )
    assert.equal(artworkUrlFromPokemon(pokemonPayload(1, null, 'home.png')), 'home.png')
    assert.equal(artworkUrlFromPokemon(pokemonPayload(1, null, null)), '')
  })
})

describe('cache', () => {
  it('mémorise une entrée entre deux lectures', () => {
    cacheSet({ id: 4, name: 'Salamèche', artworkUrl: 'https://img/4.png' })
    assert.equal(cacheGet(4).name, 'Salamèche')
  })
})

describe('chargement PokéAPI', () => {
  it('lance pokemon et species en parallèle et lit le nom FR', async () => {
    const seen = []
    const fetchImpl = makeFetch((id, url) => {
      seen.push(url)
      if (String(url).includes('pokemon-species')) return speciesPayload(id, 'Bulbizarre')
      return pokemonPayload(id, `https://img/${id}.png`)
    })
    const entry = await fetchMysteryById(1, fetchImpl)
    assert.equal(entry.id, 1)
    assert.equal(entry.name, 'Bulbizarre')
    assert.equal(entry.artworkUrl, 'https://img/1.png')
    assert.equal(seen.length, 2)
    assert.ok(seen.some((url) => url.includes('/pokemon/1')))
    assert.ok(seen.some((url) => url.includes('/pokemon-species/1')))
  })

  it('ne refait pas l’API si le cache est chaud', async () => {
    let calls = 0
    const fetchImpl = makeFetch((id, url) => {
      calls += 1
      if (String(url).includes('pokemon-species')) return speciesPayload(id, 'Pikachu')
      return pokemonPayload(id, 'https://img/25.png')
    })
    await fetchMysteryById(25, fetchImpl)
    await fetchMysteryById(25, fetchImpl)
    assert.equal(calls, 2)
  })

  it('retente un autre id après un 404, puis réussit', async () => {
    const fetchImpl = makeFetch((id, url) => {
      if (id === 1) return null
      if (String(url).includes('pokemon-species')) return speciesPayload(id, 'Herbizarre')
      return pokemonPayload(id, `https://img/${id}.png`)
    })
    const entry = await loadMysteryPokemon({
      seen: [],
      maxId: 2,
      pickId: (used) => (used.includes(1) ? 2 : 1),
      fetchImpl,
    })
    assert.equal(entry.id, 2)
    assert.equal(entry.name, 'Herbizarre')
  })

  it('affiche une erreur claire après 3 ids introuvables', async () => {
    await assert.rejects(
      () =>
        loadMysteryPokemon({
          seen: [],
          maxId: 1,
          pickId: () => 999999,
          fetchImpl: async () => jsonResponse({}, 404),
        }),
      { message: 'Impossible de charger un Pokémon : identifiant introuvable.' },
    )
  })

  it('affiche une erreur claire si le réseau est coupé', async () => {
    await assert.rejects(
      () =>
        loadMysteryPokemon({
          seen: [],
          maxId: 1,
          pickId: () => 1,
          fetchImpl: async () => {
            throw new TypeError('Failed to fetch')
          },
        }),
      { message: 'Impossible de charger un Pokémon : réseau indisponible.' },
    )
  })

  it('retente si l’artwork officiel et home sont absents', async () => {
    const fetchImpl = makeFetch((id, url) => {
      if (String(url).includes('pokemon-species')) return speciesPayload(id, `Nom-${id}`)
      if (id === 1) return pokemonPayload(1, null, null)
      return pokemonPayload(id, `https://img/${id}.png`)
    })
    const entry = await loadMysteryPokemon({
      seen: [],
      maxId: 2,
      pickId: (used) => (used.includes(1) ? 2 : 1),
      fetchImpl,
    })
    assert.equal(entry.id, 2)
  })
})

describe('session', () => {
  it('ne retombe pas sur un Pokémon déjà tiré', async () => {
    const fetchImpl = makeFetch((id, url) => {
      if (String(url).includes('pokemon-species')) return speciesPayload(id, `Nom-${id}`)
      return pokemonPayload(id, `https://img/${id}.png`)
    })
    const session = createMysterySession({ maxId: 2, fetchImpl })
    const first = await session.draw()
    const second = await session.draw()
    assert.notEqual(first.id, second.id)
    assert.deepEqual(new Set([first.id, second.id]), new Set([1, 2]))
  })
})

describe('messages d’erreur', () => {
  it('classe id, réseau et artwork', () => {
    assert.match(describeLoadError(new Error('introuvable')), /identifiant introuvable/)
    assert.match(describeLoadError(new Error('réseau')), /réseau indisponible/)
    assert.match(describeLoadError(new Error('Artwork')), /image officielle/)
  })
})
