import { supabase } from '../supabase.js'
import { getDeviceId, getLocalDeviceName } from './device.js'
import { resolveStartersByIds } from './pokeapi.js'
import { endWhosThatState, parseWhosThatState } from './whosThatGame.js'
import { GUEST_PLACEHOLDER } from './whosThatPokemon.js'
import {
  bothFinalsChosen,
  endGameState as endStarterGameState,
  GAME_DURATION_MS,
  isEnded as isStarterEnded,
  parseGameState as parseStarterGameState,
  TOTAL_ROUNDS,
} from './starterAveugle.js'

export function parseInviteState(invite) {
  if (invite?.game_id === WHOS_THAT_GAME_ID) return parseWhosThatState(invite)
  return parseStarterGameState(invite)
}

const SESSION_KEY = 'gamecenter.active-invite'

export const INVITE_TTL_MS = 5 * 60 * 1000
export const STARTER_GAME_ID = 'starter-aveugle'
export const WHOS_THAT_GAME_ID = 'whos-that-pokemon'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('')
}

function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function errorText(error) {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' ')
}

function mapInviteError(error) {
  const message = error?.message || 'Erreur inconnue.'
  const blob = errorText(error)
  if (error?.code === 'PGRST204' || /battle_results/i.test(blob)) {
    return 'Colonne battle_results absente. Lance le script SQL game_matches_battle_results dans Supabase.'
  }
  if (
    error?.code === 'PGRST205' ||
    /could not find the table/i.test(blob) ||
    (/schema cache/i.test(blob) && !/column/i.test(blob))
  ) {
    return 'Table des invitations absente. Lance le script SQL game_invites dans Supabase.'
  }
  if (/game_state|host_pick|guest_pick|game_matches/i.test(blob)) {
    return 'Colonnes de partie absentes. Lance le script SQL game_invites_starters dans Supabase.'
  }
  return message
}

export function isInviteExpired(invite) {
  if (!invite?.expires_at) return true
  return new Date(invite.expires_at).getTime() <= Date.now()
}

export function isActiveGame(invite) {
  if (!invite || isInviteExpired(invite)) return false
  const status = parseInviteState(invite).status
  return status !== 'ended'
}

export function rememberGameSession(gameId, invite) {
  if (typeof localStorage === 'undefined' || !invite?.id) return
  localStorage.setItem(
    `${SESSION_KEY}.${gameId}`,
    JSON.stringify({ id: invite.id, code: invite.code }),
  )
}

export function getGameSession(gameId) {
  if (typeof localStorage === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(`${SESSION_KEY}.${gameId}`) || 'null')
  } catch {
    return null
  }
}

export function forgetGameSession(gameId) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(`${SESSION_KEY}.${gameId}`)
}

export function resumeSummary(invite) {
  if (!invite) return ''
  const state = parseInviteState(invite)
  const friend = otherPlayerName(invite)
  if (invite.game_id === WHOS_THAT_GAME_ID) {
    if (state.status === 'lobby' || state.status === 'naming') {
      return friend ? `Préparation contre ${friend}` : 'Préparation'
    }
    if (state.status === 'countdown' || state.status === 'playing') {
      return friend ? `Partie contre ${friend}` : 'Partie en cours'
    }
    if (state.status === 'done') {
      return friend ? `Résultat contre ${friend}` : 'Résultat'
    }
    return friend ? `En cours avec ${friend}` : 'Partie en cours'
  }
  if (state.status === 'picking') {
    return friend ? `Manche ${state.round} contre ${friend}` : `Manche ${state.round}`
  }
  if (state.status === 'info') {
    return friend ? `Préparation avec ${friend}` : 'Choix des informations'
  }
  if (state.status === 'teams') {
    return friend ? `Équipes prêtes contre ${friend}` : 'Équipes prêtes'
  }
  if (state.status === 'evolve') {
    return friend ? `Évolutions contre ${friend}` : 'Évolutions finales'
  }
  if (state.status === 'preview' || state.status === 'battle') {
    return friend ? `Combat contre ${friend}` : 'Combat'
  }
  if (state.status === 'done') {
    return friend ? `Résultat contre ${friend}` : 'Résultat du combat'
  }
  return friend ? `En cours avec ${friend}` : 'Partie en cours'
}

export function otherPlayerName(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  const state = parseInviteState(invite)
  if (invite.host_device_id === deviceId) return state.guest.playerName || null
  if (invite.guest_device_id === deviceId) return state.host.playerName || null
  return state.guest.playerName || state.host.playerName || null
}

export function localPlayerName(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  const state = parseInviteState(invite)
  const role = localPlayerRole(invite, deviceId)
  if (role === 'host') return state.host.playerName || null
  if (role === 'guest') return state.guest.playerName || null
  return null
}

export function localPlayerRole(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  if (invite.host_device_id === deviceId) return 'host'
  if (invite.guest_device_id === deviceId) return 'guest'
  return null
}

export async function purgeExpiredInvites() {
  const { error } = await supabase.rpc('cleanup_expired_game_invites')
  if (error) {
    await supabase
      .from('game_invites')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .is('guest_device_id', null)
  }
}

function teamRecords(index, ids) {
  return resolveStartersByIds(index, ids).map((item) => ({
    id: item.id,
    slug: item.slug,
    fr: item.fr || '',
    en: item.en || '',
  }))
}

function finalTeamRecords(index, originalIds, finalTeam) {
  return teamRecords(index, originalIds).map((item, slot) => {
    const chosen = finalTeam?.[slot]
    if (!chosen?.pokemonId) return item
    return {
      id: chosen.pokemonId,
      pokemonId: chosen.pokemonId,
      fromId: chosen.fromId || item.id,
      slug: chosen.slug || item.slug,
      fr: chosen.name || item.fr,
      en: item.en || '',
    }
  })
}

export async function saveCompletedMatch(invite, index) {
  const state = parseStarterGameState(invite)
  const teamsReady =
    (state.host?.team || []).length >= TOTAL_ROUNDS && (state.guest?.team || []).length >= TOTAL_ROUNDS
  if (!teamsReady || state.matchSaved || state.status === 'ended') {
    return { success: true, skipped: true }
  }

  await supabase.from('game_matches').update({ invite_id: null }).eq('invite_id', invite.id)

  const { error } = await supabase.from('game_matches').insert({
    game_id: invite.game_id || STARTER_GAME_ID,
    invite_id: invite.id,
    host_name: state.host.playerName || invite.host_name,
    guest_name: state.guest.playerName || invite.guest_name,
    host_team: teamRecords(index, state.host.team),
    guest_team: teamRecords(index, state.guest.team),
  })

  if (error && error.code !== '23505') return { success: false, message: mapInviteError(error) }

  const next = { ...state, matchSaved: true }
  const updated = await updateInvite(invite.id, { game_state: next })
  return updated.success ? { success: true, invite: updated.invite } : updated
}

export async function saveMatchFinalTeams(invite, index) {
  const state = parseStarterGameState(invite)
  if (!invite?.id || !bothFinalsChosen(state)) return { success: true, skipped: true }

  const { error } = await supabase
    .from('game_matches')
    .update({
      host_team: finalTeamRecords(index, state.host.team, state.host.finalTeam),
      guest_team: finalTeamRecords(index, state.guest.team, state.guest.finalTeam),
    })
    .eq('invite_id', invite.id)

  if (error) return { success: false, message: mapInviteError(error) }
  return { success: true }
}

export async function deleteMatch(matchId) {
  if (!matchId) return { success: false, message: 'Confrontation introuvable.' }
  const { error } = await supabase.from('game_matches').delete().eq('id', matchId)
  if (error) return { success: false, message: mapInviteError(error) }
  return { success: true }
}

export async function deleteAllMatches(gameId = STARTER_GAME_ID) {
  const { error } = await supabase.from('game_matches').delete().eq('game_id', gameId)
  if (error) return { success: false, message: mapInviteError(error) }
  return { success: true }
}

export async function endInvite(invite) {
  if (!invite?.id) return { success: false, message: 'Aucune partie à terminer.' }
  const endedState =
    invite.game_id === WHOS_THAT_GAME_ID
      ? endWhosThatState(parseWhosThatState(invite))
      : endStarterGameState(parseStarterGameState(invite))
  const result = await updateInvite(invite.id, {
    game_state: endedState,
    host_pick: null,
    guest_pick: null,
    expires_at: new Date().toISOString(),
  })
  forgetGameSession(invite.game_id || STARTER_GAME_ID)
  return result
}

export async function fetchActiveInviteForDevice(gameId = STARTER_GAME_ID) {
  const deviceId = getDeviceId()
  const session = getGameSession(gameId)
  if (session?.id) {
    const byId = await fetchInviteById(session.id)
    if (byId.success && localPlayerRole(byId.invite) && isActiveGame(byId.invite)) {
      rememberGameSession(gameId, byId.invite)
      return { success: true, invite: byId.invite }
    }
    if (byId.missing || (byId.success && !isActiveGame(byId.invite))) {
      forgetGameSession(gameId)
    }
  }

  const { data, error } = await supabase
    .from('game_invites')
    .select('*')
    .eq('game_id', gameId)
    .or(`host_device_id.eq.${deviceId},guest_device_id.eq.${deviceId}`)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) return { success: false, message: mapInviteError(error), invite: null }
  const invite = (data || []).find((row) => isActiveGame(row) && localPlayerRole(row)) || null
  if (invite) rememberGameSession(gameId, invite)
  else forgetGameSession(gameId)
  return { success: true, invite }
}

export function compactBattleResults(results) {
  if (!results || typeof results !== 'object') return null
  return {
    played: results.played || 0,
    hostWins: results.hostWins || 0,
    guestWins: results.guestWins || 0,
    ties: results.ties || 0,
    avgTurns: results.avgTurns || 0,
    interval: results.interval || null,
    verdict: results.verdict || '',
    hostWinRate: results.hostWinRate ?? 0,
    guestWinRate: results.guestWinRate ?? 0,
    hostStats: results.hostStats || [],
    guestStats: results.guestStats || [],
    hostMvp: results.hostMvp || null,
    guestMvp: results.guestMvp || null,
    recaps: results.recaps || null,
    status: 'done',
    progress: 100,
    savedAt: new Date().toISOString(),
  }
}

export async function saveMatchBattleResults({ matchId, inviteId } = {}, results) {
  const payload = compactBattleResults(results)
  if (!payload || (!matchId && !inviteId)) return { success: true, skipped: true }

  let query = supabase.from('game_matches').update({ battle_results: payload })
  query = matchId ? query.eq('id', matchId) : query.eq('invite_id', inviteId)
  const { error } = await query
  if (error) return { success: false, message: mapInviteError(error) }
  return { success: true, results: payload }
}

export async function saveWhosThatMatch({ hostName, guestName, results, inviteId } = {}) {
  if (!results) return { success: false, message: 'Résultat manquant.' }
  if (inviteId) {
    await supabase.from('game_matches').update({ invite_id: null }).eq('invite_id', inviteId)
  }
  const { error } = await supabase.from('game_matches').insert({
    game_id: WHOS_THAT_GAME_ID,
    invite_id: inviteId || null,
    host_name: String(hostName || getLocalDeviceName() || 'Joueur').trim() || 'Joueur',
    guest_name: String(guestName || GUEST_PLACEHOLDER).trim() || GUEST_PLACEHOLDER,
    host_team: [],
    guest_team: [],
    battle_results: results,
  })
  if (error && error.code === '23505') return { success: true, results, skipped: true }
  if (error) return { success: false, message: mapInviteError(error) }
  return { success: true, results }
}

export async function fetchMatchHistory(gameId = STARTER_GAME_ID) {
  const query = () =>
    supabase
      .from('game_matches')
      .select('id, host_name, guest_name, host_team, guest_team, battle_results, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(40)

  let { data, error } = await query()
  if (error && (error.code === 'PGRST204' || /battle_results/i.test(errorText(error)))) {
    const fallback = await supabase
      .from('game_matches')
      .select('id, host_name, guest_name, host_team, guest_team, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(40)
    data = fallback.data
    error = fallback.error
  }
  if (error) return { success: false, message: mapInviteError(error), matches: [] }
  return { success: true, matches: data || [] }
}

export async function createInvite(gameId = STARTER_GAME_ID, extra = {}) {
  await purgeExpiredInvites()
  const hostName = getLocalDeviceName()
  const hostDeviceId = getDeviceId()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('game_invites')
      .insert({
        code,
        game_id: gameId,
        host_name: hostName,
        host_device_id: hostDeviceId,
        expires_at: expiresAt,
        ...extra,
      })
      .select('*')
      .single()

    if (!error) {
      rememberGameSession(gameId, data)
      return { success: true, invite: data }
    }
    if (error.code !== '23505') {
      return { success: false, message: mapInviteError(error) }
    }
  }

  return { success: false, message: 'Impossible de générer un code. Réessaie.' }
}

export async function fetchInviteByCode(rawCode) {
  const code = normalizeCode(rawCode)
  if (code.length < 4) {
    return { success: false, message: 'Code trop court.' }
  }

  const { data, error } = await supabase.from('game_invites').select('*').eq('code', code).maybeSingle()
  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, message: 'Code introuvable.' }
  if (isInviteExpired(data)) return { success: false, message: 'Ce code a expiré (5 minutes max).' }
  return { success: true, invite: data }
}

export async function joinInvite(rawCode, expectedGameId = null) {
  await purgeExpiredInvites()
  const loaded = await fetchInviteByCode(rawCode)
  if (!loaded.success) return loaded

  const invite = loaded.invite
  if (expectedGameId && invite.game_id !== expectedGameId) {
    return { success: false, message: 'Ce code n’est valable que pour un autre jeu.' }
  }

  const deviceId = getDeviceId()
  const name = getLocalDeviceName()

  if (invite.host_device_id === deviceId) {
    rememberGameSession(invite.game_id, invite)
    return { success: true, invite, alreadyHost: true }
  }

  if (invite.guest_device_id && invite.guest_device_id !== deviceId) {
    return { success: false, message: 'Ce code a déjà été utilisé.' }
  }

  if (invite.guest_device_id === deviceId) {
    rememberGameSession(invite.game_id, invite)
    return { success: true, invite }
  }

  const { data, error } = await supabase
    .from('game_invites')
    .update({
      guest_name: name,
      guest_device_id: deviceId,
      joined_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + GAME_DURATION_MS).toISOString(),
      game_state: parseInviteState(invite),
    })
    .eq('id', invite.id)
    .is('guest_device_id', null)
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle()

  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, message: 'Code déjà utilisé ou expiré.' }
  rememberGameSession(data.game_id, data)
  return { success: true, invite: data }
}

export async function updateInvite(id, fields) {
  const { data, error } = await supabase
    .from('game_invites')
    .update(fields)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, message: 'Invitation introuvable.' }
  return { success: true, invite: data }
}

export async function fetchInviteById(id) {
  const { data, error } = await supabase.from('game_invites').select('*').eq('id', id).maybeSingle()
  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, missing: true, message: 'Invitation introuvable.' }
  return { success: true, invite: data }
}

export function watchInvite(inviteId, onChange) {
  const channel = supabase
    .channel(`game-invite-${inviteId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_invites', filter: `id=eq.${inviteId}` },
      (payload) => {
        if (payload.eventType === 'DELETE' || payload.event === 'DELETE') onChange(null)
        else if (payload.new) onChange(payload.new)
      },
    )
    .subscribe()

  const pollId = window.setInterval(async () => {
    const result = await fetchInviteById(inviteId)
    if (result.success) onChange(result.invite)
    else if (result.missing) onChange(null)
  }, 2500)

  return () => {
    window.clearInterval(pollId)
    supabase.removeChannel(channel)
  }
}
