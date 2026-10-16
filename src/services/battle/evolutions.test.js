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
