import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { clearPokeMemory } from './pokeCache.js'
import { getFinalEvolutions } from './evolutions.js'

const originalFetch = globalThis.fetch

const json = (body) =>
  Promise.resolve({
    ok: true,
    json: async () => body,
  })

function chain(root, branches) {
  return {
    chain: {
      species: { name: root, url: `https://pokeapi.co/api/v2/pokemon-species/${root}/` },
      evolves_to: branches.map((node) =>
        typeof node === 'string'
          ? { species: { name: node, url: `https://pokeapi.co/api/v2/pokemon-species/${node}/` }, evolves_to: [] }
          : node,
      ),
    },
  }
}

function species(name, id, varieties = [name]) {
  return {
    id,
    name,
    names: [{ language: { name: 'fr' }, name: name[0].toUpperCase() + name.slice(1) }],
    evolution_chain: { url: `https://pokeapi.co/api/v2/evolution-chain/${name}/` },
    varieties: varieties.map((slug, index) => ({
      is_default: index === 0,
      pokemon: { name: slug, url: `https://pokeapi.co/api/v2/pokemon/${slug}/` },
    })),
  }
}

function pokemon(name, id) {
  return {
    id,
    name,
    species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${name}/` },
    sprites: { front_default: `${name}.png`, other: { 'official-artwork': { front_default: `${name}.png` } } },
    forms: [{ name }],
    types: [{ type: { name: 'normal' } }],
    stats: [],
    abilities: [],
    moves: [],
  }
}

function form(name, flags = {}) {
  return { name, is_mega: false, is_battle_only: false, ...flags }
}

describe('évolutions finales', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    clearPokeMemory()
  })

  it('applique une unique évolution (Bulbizarre → Florizarre)', async () => {
    globalThis.fetch = (url) => {
      const path = String(url)
      if (path.includes('pokemon-species/1') || path.includes('pokemon-species/bulbasaur')) {
        return json(species('bulbasaur', 1))
      }
      if (path.includes('evolution-chain/bulbasaur')) {
        return json(
          chain('bulbasaur', [
            {
              species: { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon-species/ivysaur/' },
              evolves_to: [
                { species: { name: 'venusaur', url: 'https://pokeapi.co/api/v2/pokemon-species/venusaur/' }, evolves_to: [] },
              ],
            },
          ]),
        )
      }
      if (path.includes('pokemon-species/venusaur')) return json(species('venusaur', 3))
      if (path.includes('pokemon/venusaur')) return json(pokemon('venusaur', 3))
      if (path.includes('pokemon-form/venusaur')) return json(form('venusaur'))
      return json({})
    }
    const result = await getFinalEvolutions(1)
    assert.equal(result.auto.slug, 'venusaur')
    assert.equal(result.options.length, 1)
  })

  it('propose plusieurs évolutions pour Évoli', async () => {
    const eeveelutions = ['vaporeon', 'jolteon', 'flareon']
    globalThis.fetch = (url) => {
      const path = String(url)
      if (path.includes('pokemon-species/eevee') || path.includes('pokemon-species/133')) {
        return json(species('eevee', 133))
      }
      if (path.includes('evolution-chain/eevee')) return json(chain('eevee', eeveelutions))
      for (const name of eeveelutions) {
        if (path.includes(`pokemon-species/${name}`)) return json(species(name, name.length))
        if (path.includes(`/pokemon/${name}`)) return json(pokemon(name, name.length))
        if (path.includes(`pokemon-form/${name}`)) return json(form(name))
      }
      return json({})
    }
    const result = await getFinalEvolutions('eevee')
    assert.equal(result.auto, null)
    assert.deepEqual(result.options.map((item) => item.slug).sort(), [...eeveelutions].sort())
  })

  it('verrouille une forme déjà finale (Gardevoir, pas Gallame)', async () => {
    globalThis.fetch = (url) => {
      const path = String(url)
      if (path.includes('pokemon-species/gardevoir') || path.includes('pokemon-species/282')) {
        return json(species('gardevoir', 282))
      }
      if (path.includes('evolution-chain/gardevoir')) {
        return json({
          chain: {
            species: { name: 'ralts', url: 'https://pokeapi.co/api/v2/pokemon-species/ralts/' },
            evolves_to: [
              {
                species: { name: 'kirlia', url: 'https://pokeapi.co/api/v2/pokemon-species/kirlia/' },
                evolves_to: [
                  {
                    species: { name: 'gardevoir', url: 'https://pokeapi.co/api/v2/pokemon-species/gardevoir/' },
                    evolves_to: [],
                  },
                  {
                    species: { name: 'gallade', url: 'https://pokeapi.co/api/v2/pokemon-species/gallade/' },
                    evolves_to: [],
                  },
                ],
              },
            ],
          },
        })
      }
      if (path.includes('/pokemon/gardevoir') || path.includes('/pokemon/282')) return json(pokemon('gardevoir', 282))
      if (path.includes('pokemon-form/gardevoir')) return json(form('gardevoir'))
      if (path.includes('gallade')) return json(pokemon('gallade', 475))
      return json({})
    }
    const result = await getFinalEvolutions(282)
    assert.equal(result.locked, true)
    assert.equal(result.auto.slug, 'gardevoir')
    assert.equal(result.options.length, 1)
    assert.equal(result.options.some((item) => item.slug === 'gallade'), false)
  })

  it('propose Gardevoir et Gallame depuis Kirlia', async () => {
    globalThis.fetch = (url) => {
      const path = String(url)
      if (path.includes('pokemon-species/kirlia') || path.includes('pokemon-species/281')) {
        return json(species('kirlia', 281))
      }
      if (path.includes('evolution-chain/kirlia')) {
        return json({
          chain: {
            species: { name: 'ralts', url: 'https://pokeapi.co/api/v2/pokemon-species/ralts/' },
            evolves_to: [
              {
                species: { name: 'kirlia', url: 'https://pokeapi.co/api/v2/pokemon-species/kirlia/' },
                evolves_to: [
                  {
                    species: { name: 'gardevoir', url: 'https://pokeapi.co/api/v2/pokemon-species/gardevoir/' },
                    evolves_to: [],
                  },
                  {
                    species: { name: 'gallade', url: 'https://pokeapi.co/api/v2/pokemon-species/gallade/' },
                    evolves_to: [],
                  },
                ],
              },
            ],
          },
        })
      }
      if (path.includes('pokemon-species/gardevoir')) return json(species('gardevoir', 282))
      if (path.includes('pokemon-species/gallade')) return json(species('gallade', 475))
      if (path.includes('/pokemon/gardevoir')) return json(pokemon('gardevoir', 282))
      if (path.includes('/pokemon/gallade')) return json(pokemon('gallade', 475))
      if (path.includes('pokemon-form/gardevoir')) return json(form('gardevoir'))
      if (path.includes('pokemon-form/gallade')) return json(form('gallade'))
      return json({})
    }
    const result = await getFinalEvolutions(281)
    assert.equal(result.locked, false)
    assert.deepEqual(result.options.map((item) => item.slug).sort(), ['gallade', 'gardevoir'])
  })

  it('laisse un Pokémon sans évolution tel quel (Métamorph)', async () => {
    globalThis.fetch = (url) => {
      const path = String(url)
      if (path.includes('pokemon-species/ditto')) return json(species('ditto', 132))
      if (path.includes('evolution-chain/ditto')) return json(chain('ditto', []))
      if (path.includes('/pokemon/ditto')) return json(pokemon('ditto', 132))
      if (path.includes('pokemon-form/ditto')) return json(form('ditto'))
      return json({})
    }
    const result = await getFinalEvolutions('ditto')
    assert.equal(result.auto.slug, 'ditto')
  })
})
