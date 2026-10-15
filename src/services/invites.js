import { supabase } from '../supabase.js'
import { getDeviceId, getLocalDeviceName } from './device.js'
import { resolveStartersByIds } from './pokeapi.js'
import { endGameState, GAME_DURATION_MS, isEnded, parseGameState } from './starterAveugle.js'

const SESSION_KEY = 'gamecenter.active-invite'

export const INVITE_TTL_MS = 5 * 60 * 1000
export const STARTER_GAME_ID = 'starter-aveugle'

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

function mapInviteError(error) {
  const message = error?.message || 'Erreur inconnue.'
  if (
    error?.code === 'PGRST205' ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  ) {
    return 'Table des invitations absente. Lance le script SQL game_invites dans Supabase.'
  }
  if (/game_state|host_pick|guest_pick|game_matches|PGRST204/i.test(message) || error?.code === 'PGRST204') {
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
  const status = parseGameState(invite).status
  return status !== 'done' && status !== 'ended'
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
  const state = parseGameState(invite)
  const friend = otherPlayerName(invite)
  if (state.status === 'picking') {
    return friend ? `Manche ${state.round} contre ${friend}` : `Manche ${state.round}`
  }
  if (state.status === 'info') {
    return friend ? `Préparation avec ${friend}` : 'Choix des informations'
  }
  return friend ? `En cours avec ${friend}` : 'Partie en cours'
}

export function otherPlayerName(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  const state = parseGameState(invite)
  if (invite.host_device_id === deviceId) return state.guest.playerName || null
  if (invite.guest_device_id === deviceId) return state.host.playerName || null
  return state.guest.playerName || state.host.playerName || null
}

export function localPlayerName(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  const state = parseGameState(invite)
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

export async function saveCompletedMatch(invite, index) {
  const state = parseGameState(invite)
  if (state.status !== 'done' || state.matchSaved) {
    return { success: true, skipped: true }
  }

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

export async function endInvite(invite) {
  if (!invite?.id) return { success: false, message: 'Aucune partie à terminer.' }
  const result = await updateInvite(invite.id, {
    game_state: endGameState(parseGameState(invite)),
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
    if (byId.missing || (byId.success && (isEnded(parseGameState(byId.invite)) || !isActiveGame(byId.invite)))) {
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

export async function fetchMatchHistory(gameId = STARTER_GAME_ID) {
  const { data, error } = await supabase
    .from('game_matches')
    .select('id, host_name, guest_name, host_team, guest_team, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(40)

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
      game_state: parseGameState(invite),
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
