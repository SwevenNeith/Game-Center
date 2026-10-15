/**
 * Catalogue des jeux.
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   to?: string,
 *   image?: string,
 *   status?: 'ready' | 'coming_soon'
 * }} Game
 */

/** @type {Game[]} */
export const games = [
  {
    id: 'starter-aveugle',
    name: 'Starter à l’aveugle',
    description: 'Choisis un starter sans le voir — et fouille le Pokédex en attendant.',
    to: '/starter-aveugle',
    status: 'ready',
  },
]

export function getGameById(id) {
  return games.find((game) => game.id === id) || null
}
