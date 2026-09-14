/**
 * Catalogue des jeux.
 * Chaque entrée pourra porter sa propre charte via `theme`.
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   to?: string,
 *   status?: 'ready' | 'coming_soon',
 *   theme?: { background: string, accent: string, text: string }
 * }} Game
 */

/** @type {Game[]} */
export const games = []
