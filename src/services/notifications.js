// ============================================
// CONFIGURATION
// ============================================

// Clé publique VAPID générée sur vapidkeys.com
const VAPID_PUBLIC_KEY = 'TA_CLE_VAPID_PUBLIQUE_ICI'

// URL de ta Supabase Edge Function
const EDGE_FUNCTION_URL = 'https://TON_PROJET.supabase.co/functions/v1/send-notification'


// ============================================
// CONVERTIR LA CLÉ VAPID
// ============================================

// Convertit la clé publique au format requis par l'API Web Push
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}


// ============================================
// DEMANDER LA PERMISSION ET S'ABONNER
// ============================================

// Appelle cette fonction au démarrage de l'app
// Elle demande la permission et sauvegarde la subscription dans Supabase
export async function demanderPermissionNotifications(supabase) {
  if (!('Notification' in window)) {
    console.log('Ce navigateur ne supporte pas les notifications')
    return false
  }

  if (!('serviceWorker' in navigator)) {
    console.log('Ce navigateur ne supporte pas les Service Workers')
    return false
  }

  // Affiche le popup de permission à l'utilisateur
  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    console.log('Permission refusée par l\'utilisateur')
    return false
  }

  // Récupère le Service Worker actif
  const registration = await navigator.serviceWorker.ready

  // Crée la subscription push avec la clé VAPID
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  })

  // Sauvegarde la subscription dans Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ subscription: subscription.toJSON() })

  if (error) {
    console.error('Erreur lors de la sauvegarde de la subscription :', error)
    return false
  }

  console.log('Notifications activées avec succès !')
  return true
}


// ============================================
// NOTIFICATION MANUELLE
// ============================================

// Envoie une notification immédiatement
export async function envoyerNotificationManuelle(title, body) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'manuel', title, body })
  })

  if (!response.ok) {
    console.error('Erreur lors de l\'envoi de la notification manuelle')
  }
}


// ============================================
// NOTIFICATION PLANIFIÉE
// ============================================

// Planifie une notification à une heure précise
// scheduledAt : date ISO string (ex: "2024-01-15T14:00:00.000Z")
export async function planifierNotification(title, body, scheduledAt) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'planifie', title, body, scheduledAt })
  })

  if (!response.ok) {
    console.error('Erreur lors de la planification de la notification')
  }
}