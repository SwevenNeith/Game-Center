import { supabase } from '../supabase.js'
import { getDeviceId, getLocalDeviceName } from './device.js'

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
  return message
}

export function isInviteExpired(invite) {
  if (!invite?.expires_at) return true
  return new Date(invite.expires_at).getTime() <= Date.now()
}

export function otherPlayerName(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  if (invite.host_device_id === deviceId) return invite.guest_name || null
  if (invite.guest_device_id === deviceId) return invite.host_name || null
  return invite.guest_name || invite.host_name || null
}

export function localPlayerRole(invite, deviceId = getDeviceId()) {
  if (!invite) return null
  if (invite.host_device_id === deviceId) return 'host'
  if (invite.guest_device_id === deviceId) return 'guest'
  return null
}

export async function createInvite(gameId = STARTER_GAME_ID) {
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
      })
      .select('*')
      .single()

    if (!error) return { success: true, invite: data }
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
  const loaded = await fetchInviteByCode(rawCode)
  if (!loaded.success) return loaded

  const invite = loaded.invite
  if (expectedGameId && invite.game_id !== expectedGameId) {
    return { success: false, message: 'Ce code n’est valable que pour un autre jeu.' }
  }

  const deviceId = getDeviceId()
  const name = getLocalDeviceName()

  if (invite.host_device_id === deviceId) {
    return { success: true, invite, alreadyHost: true }
  }

  if (invite.guest_device_id && invite.guest_device_id !== deviceId) {
    return { success: false, message: 'Ce code a déjà été utilisé.' }
  }

  if (invite.guest_device_id === deviceId) {
    return { success: true, invite }
  }

  const { data, error } = await supabase
    .from('game_invites')
    .update({
      guest_name: name,
      guest_device_id: deviceId,
      joined_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .is('guest_device_id', null)
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle()

  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, message: 'Code déjà utilisé ou expiré.' }
  return { success: true, invite: data }
}

export async function fetchInviteById(id) {
  const { data, error } = await supabase.from('game_invites').select('*').eq('id', id).maybeSingle()
  if (error) return { success: false, message: mapInviteError(error) }
  if (!data) return { success: false, message: 'Invitation introuvable.' }
  return { success: true, invite: data }
}

export function watchInvite(inviteId, onChange) {
  const channel = supabase
    .channel(`game-invite-${inviteId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_invites', filter: `id=eq.${inviteId}` },
      (payload) => {
        if (payload.new) onChange(payload.new)
      },
    )
    .subscribe()

  const pollId = window.setInterval(async () => {
    const result = await fetchInviteById(inviteId)
    if (result.success) onChange(result.invite)
  }, 2500)

  return () => {
    window.clearInterval(pollId)
    supabase.removeChannel(channel)
  }
}
