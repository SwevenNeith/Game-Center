import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase.js'

// Clé publique VAPID (volontairement côté client, comme BetterMe).
// L'env VITE_VAPID_PUBLIC_KEY reste prioritaire si elle est définie au build.
const VAPID_PUBLIC_KEY = String(
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    'BEWdUGS7Kma5O89omPhVbZ_DlEVeoyI4__Xt2nc6JOCo8K-H7apEDw8j5B_i_uZOeATy_b-xXQbrkpCjl5iwPtk',
).trim()
const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/send-notification`
const DEVICE_LABELS_KEY = 'gamecenter.deviceLabels'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function withTimeout(promise, ms, message) {
  let timeoutId
  return Promise.race([
    promise.finally(() => window.clearTimeout(timeoutId)),
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

function readDeviceLabels() {
  try {
    const raw = localStorage.getItem(DEVICE_LABELS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDeviceLabel(endpoint, label) {
  if (!endpoint || !label) return
  const labels = readDeviceLabels()
  labels[endpoint] = label
  localStorage.setItem(DEVICE_LABELS_KEY, JSON.stringify(labels))
}

export function detectDeviceName() {
  if (typeof navigator === 'undefined') return 'Cet appareil'

  const ua = navigator.userAgent
  const platform = navigator.userAgentData?.platform || navigator.platform || ''

  let browser = 'Navigateur'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'

  let os = 'appareil'
  if (/Windows/i.test(platform) || /Windows/i.test(ua)) os = 'Windows'
  else if (/Mac/i.test(platform) || /Mac OS/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Linux/i.test(platform) || /Linux/i.test(ua)) os = 'Linux'

  return `${browser} · ${os}`
}

export function estIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function estModePwa() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(navigator.standalone)
  )
}

export function notificationsIosNecessitentInstallation() {
  return estIos() && !estModePwa()
}

export function notificationsSupportees() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function vapidPublicKeyDisponible() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY !== 'TA_CLE_VAPID_PUBLIQUE_ICI')
}

function swUrl() {
  return `${import.meta.env.BASE_URL || '/'}sw.js`
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null

  const base = import.meta.env.BASE_URL || '/'
  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(
    registrations.map(async (registration) => {
      const script =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        ''
      let pathname = ''
      try {
        pathname = new URL(script).pathname
      } catch {
        pathname = ''
      }
      // Ancien SW Vite enregistré sur "/" → 404, bloque pushManager.subscribe.
      if (pathname === '/sw.js') await registration.unregister()
    }),
  )

  await navigator.serviceWorker.register(swUrl(), { scope: base })
  return withTimeout(
    navigator.serviceWorker.ready,
    8000,
    'Le Service Worker n’a pas démarré. Recharge la page.',
  )
}

export async function obtenirEtatNotifications() {
  if (!notificationsSupportees()) {
    return { supported: false, permission: 'unsupported', showPrompt: false, showDeniedHelp: false }
  }

  const permission = Notification.permission
  return {
    supported: true,
    permission,
    showPrompt: permission === 'default',
    showDeniedHelp: permission === 'denied',
  }
}

async function peekCurrentEndpoint() {
  if (!('serviceWorker' in navigator)) return null
  const registrations = await navigator.serviceWorker.getRegistrations()
  for (const registration of registrations) {
    try {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription?.endpoint) return subscription.endpoint
    } catch {
      // ignore
    }
  }
  return null
}

function errorReason(error, fallback = 'subscription_failed') {
  const message = error?.message || String(error || '')
  return { success: false, reason: fallback, message }
}

async function enregistrerSubscription(deviceName) {
  if (!vapidPublicKeyDisponible()) {
    return { success: false, reason: 'missing_vapid' }
  }

  try {
    const registration = await ensureServiceWorker()
    if (!registration?.pushManager) {
      return { success: false, reason: 'unsupported', message: 'Service Worker indisponible.' }
    }

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }),
        10000,
        'Abonnement push bloqué. Recharge la page puis réessaie.',
      )
    }

    const subscriptionJson = subscription.toJSON()
    const endpoint = subscriptionJson.endpoint
    if (!endpoint) {
      return { success: false, reason: 'subscription_failed', message: 'Endpoint push manquant.' }
    }

    const nom = (deviceName || detectDeviceName()).trim()
    writeDeviceLabel(endpoint, nom)

    const { data: rows, error: selectError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, nom')

    if (selectError) return errorReason(selectError)

    const existing = (rows ?? []).find((row) => row.subscription?.endpoint === endpoint)
    const payload = { subscription: subscriptionJson }

    if (existing) {
      if (deviceName || !existing.nom) payload.nom = nom
      const { error } = await supabase.from('push_subscriptions').update(payload).eq('id', existing.id)
      if (error) return errorReason(error)
    } else {
      payload.nom = nom
      const { error } = await supabase.from('push_subscriptions').insert(payload)
      if (error) return errorReason(error)
    }

    return { success: true }
  } catch (err) {
    console.error('enregistrerSubscription:', err)
    return errorReason(err)
  }
}

export async function synchroniserNotificationsAccordees() {
  if (!notificationsSupportees() || Notification.permission !== 'granted') {
    return { success: false, reason: 'not_granted' }
  }

  try {
    const result = await enregistrerSubscription()
    if (result.success) {
      window.dispatchEvent(new CustomEvent('gamecenter-notifications-granted'))
    }
    return result
  } catch (err) {
    return errorReason(err)
  }
}

/** Appeler requestPermission() en tout premier depuis le clic, avant tout await Vue. */
export async function activerNotificationsUtilisateur(deviceName, permission) {
  if (!notificationsSupportees()) {
    return { success: false, reason: 'unsupported' }
  }

  if (!vapidPublicKeyDisponible()) {
    return { success: false, reason: 'missing_vapid' }
  }

  try {
    const resolvedPermission = permission || (await Notification.requestPermission())
    if (resolvedPermission === 'denied') return { success: false, reason: 'denied' }
    if (resolvedPermission !== 'granted') return { success: false, reason: 'pending' }

    const result = await enregistrerSubscription(deviceName)
    if (result.success) {
      window.dispatchEvent(new CustomEvent('gamecenter-notifications-granted'))
    }
    return result
  } catch (err) {
    console.error('activerNotificationsUtilisateur:', err)
    return errorReason(err)
  }
}

export async function listerAppareilsLies() {
  const { data, error } = await supabase.from('push_subscriptions').select('*')

  if (error) {
    return { success: false, devices: [], error: error.message }
  }

  const currentEndpoint = await peekCurrentEndpoint()
  const devices = (data ?? []).map((row) => {
    const endpoint = row.subscription?.endpoint || ''
    const labels = readDeviceLabels()
    const shortId = String(row?.id || '').slice(0, 8)
    const nom = row.nom || labels[endpoint] || (shortId ? `Appareil ${shortId}` : 'Appareil')
    const isCurrent = Boolean(endpoint && endpoint === currentEndpoint)
    return {
      id: row.id,
      endpoint,
      createdAt: row.created_at || null,
      nom,
      label: isCurrent ? `${nom} (cet appareil)` : nom,
      isCurrent,
    }
  })

  devices.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
  return { success: true, devices }
}

export async function cetAppareilEstLie() {
  const result = await listerAppareilsLies()
  return Boolean(result.success && result.devices.some((device) => device.isCurrent))
}

export async function renommerAppareil(id, nom) {
  const trimmed = String(nom || '').trim()
  if (!id || !trimmed) {
    return { success: false, message: 'Le nom ne peut pas être vide.' }
  }

  const { error } = await supabase.from('push_subscriptions').update({ nom: trimmed }).eq('id', id)
  if (error) return { success: false, message: error.message }

  const { data: row } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('id', id)
    .maybeSingle()
  writeDeviceLabel(row?.subscription?.endpoint, trimmed)
  return { success: true }
}

async function unsubscribeCurrentPush() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  for (const registration of registrations) {
    try {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
    } catch (err) {
      console.warn('unsubscribe:', err)
    }
  }
}

export async function supprimerAppareil(id) {
  if (!id) return { success: false, message: 'Appareil introuvable.', isCurrent: false }

  const { data: row, error: readError } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('id', id)
    .maybeSingle()

  if (readError) return { success: false, message: readError.message, isCurrent: false }

  const endpoint = row?.subscription?.endpoint || ''
  const currentEndpoint = await peekCurrentEndpoint()
  const isCurrent = Boolean(endpoint && endpoint === currentEndpoint)

  const { error } = await supabase.from('push_subscriptions').delete().eq('id', id)
  if (error) return { success: false, message: error.message, isCurrent: false }

  if (isCurrent) {
    await unsubscribeCurrentPush()
    window.dispatchEvent(new CustomEvent('gamecenter-device-unlinked'))
  }

  window.dispatchEvent(new CustomEvent('gamecenter-devices-updated'))
  return { success: true, isCurrent }
}

export async function testerNotificationPush({
  title = 'Game Center',
  body = 'Notification test',
  subscriptionIds,
} = {}) {
  try {
    const payload = { type: 'manuel', title, body }
    if (Array.isArray(subscriptionIds) && subscriptionIds.length) {
      payload.subscriptionIds = subscriptionIds
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) return { success: false }

    const json = await response.json().catch(() => ({ success: true }))
    return { success: true, sent: json.sent, failed: json.failed }
  } catch (err) {
    console.error('Edge Function send-notification:', err)
    return { success: false }
  }
}
