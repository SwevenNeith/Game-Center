<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  notificationsSupportees,
  obtenirEtatNotifications,
  activerNotificationsUtilisateur,
  vapidPublicKeyDisponible,
  detectDeviceName,
  notificationsIosNecessitentInstallation,
  cetAppareilEstLie,
} from '../services/notifications.js'

const emit = defineEmits(['linked'])

const visible = ref(false)
const denied = ref(false)
const unsupported = ref(false)
const linked = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const deviceName = ref(detectDeviceName())
const iosInstall = ref(false)

async function refreshEtat() {
  errorMessage.value = ''
  linked.value = false

  iosInstall.value = notificationsIosNecessitentInstallation()
  if (iosInstall.value) {
    visible.value = true
    return
  }

  if (!notificationsSupportees()) {
    unsupported.value = true
    visible.value = true
    return
  }

  if (!vapidPublicKeyDisponible()) {
    visible.value = true
    errorMessage.value =
      'La clé publique VAPID est manquante. Ajoute VITE_VAPID_PUBLIC_KEY dans le fichier .env (la même que le secret Supabase).'
  }

  const etat = await obtenirEtatNotifications()

  if (etat.showDeniedHelp) {
    denied.value = true
    visible.value = true
    return
  }

  if (etat.permission === 'granted') {
    const alreadyLinked = await cetAppareilEstLie()
    if (alreadyLinked) {
      visible.value = false
      emit('linked')
      return
    }
    visible.value = true
    return
  }

  if (etat.showPrompt) {
    denied.value = false
    visible.value = true
  }
}

function messagePourErreur(result) {
  if (result.reason === 'denied') return null
  if (result.reason === 'missing_vapid') {
    return 'La clé publique VAPID est manquante. Ajoute VITE_VAPID_PUBLIC_KEY dans le fichier .env (la même que le secret Supabase).'
  }
  if (result.reason === 'unsupported') {
    return 'Les notifications push ne sont pas disponibles sur cet appareil.'
  }
  if (result.message) {
    return `Enregistrement impossible : ${result.message}`
  }
  if (result.reason === 'subscription_failed') {
    return "Permission accordée, mais l'enregistrement a échoué. Exécute le SQL RLS sur push_subscriptions."
  }
  return 'Autorisation annulée ou en attente.'
}

function showRelinkForm() {
  linked.value = false
  denied.value = false
  visible.value = true
}

onMounted(() => {
  refreshEtat()
  window.addEventListener('gamecenter-device-unlinked', showRelinkForm)
})

onUnmounted(() => {
  window.removeEventListener('gamecenter-device-unlinked', showRelinkForm)
})

async function onAutoriser() {
  // Premier await = requestPermission, pendant le geste du clic (sinon Chrome n'affiche rien).
  let permission = 'default'
  try {
    permission = await Notification.requestPermission()
  } catch (err) {
    errorMessage.value = err?.message || "Impossible de demander la permission."
    return
  }

  loading.value = true
  errorMessage.value = ''
  linked.value = false

  try {
    const result = await activerNotificationsUtilisateur(deviceName.value, permission)

    if (result.success) {
      linked.value = true
      visible.value = true
      emit('linked')
      return
    }

    if (result.reason === 'denied') {
      denied.value = true
      visible.value = true
      return
    }

    errorMessage.value = messagePourErreur(result)
  } catch (err) {
    errorMessage.value = err?.message || "Impossible d'activer les notifications."
  } finally {
    loading.value = false
  }
}

function dismissLinked() {
  visible.value = false
}
</script>

<template>
  <div
    v-if="visible"
    class="notif-prompt"
    role="region"
    :aria-label="linked ? 'Notifications autorisées' : 'Activation des notifications'"
  >
    <div class="notif-prompt-inner" :class="{ 'notif-prompt-inner--success': linked }">
      <p class="notif-prompt-icon" aria-hidden="true">{{ linked ? '✓' : '🔔' }}</p>

      <div v-if="linked" class="notif-prompt-text">
        <strong>Notifications autorisées</strong>
        <span>
          Cet appareil est maintenant lié à Game Center. Tu peux envoyer un test ci-dessous pour
          vérifier que tout fonctionne.
        </span>
      </div>

      <div v-else-if="iosInstall" class="notif-prompt-text">
        <strong>Installe l’app sur iPhone</strong>
        <span>
          Sur iOS, les notifications marchent uniquement après ajout à l’écran d’accueil : bouton
          Partager → Sur l’écran d’accueil. Ouvre ensuite Game Center depuis l’icône, puis autorise
          les notifications.
        </span>
      </div>

      <div v-else-if="unsupported" class="notif-prompt-text">
        <strong>Notifications non disponibles</strong>
        <span>
          Ton navigateur ou appareil ne prend pas en charge les notifications push. Essaie Chrome,
          Firefox ou Safari récent (idéalement en installant l’app sur l’écran d’accueil sur
          iPhone).
        </span>
      </div>

      <div v-else-if="denied" class="notif-prompt-text">
        <strong>Notifications bloquées</strong>
        <span>
          Tu as refusé les notifications. Sur ordinateur : icône à gauche de l’URL → Notifications →
          Autoriser. Sur téléphone : cadenas / Paramètres du site → Notifications → Autoriser, puis
          recharge.
        </span>
      </div>

      <div v-else class="notif-prompt-text">
        <strong>Lier cet appareil</strong>
        <span>
          Autorise les notifications pour lier cet appareil. Chrome peut afficher une fenêtre
          « Notifications bloquées » : clique sur Autoriser, c’est bien la demande d’accès.
        </span>
        <label class="notif-device-name">
          <span>Nom de l’appareil</span>
          <input v-model="deviceName" type="text" maxlength="80" autocomplete="off" />
        </label>
      </div>

      <p v-if="errorMessage" class="notif-prompt-error">{{ errorMessage }}</p>

      <div v-if="linked" class="notif-prompt-actions">
        <button type="button" class="notif-btn notif-btn--ghost" @click="dismissLinked">
          Compris
        </button>
      </div>

      <div v-else-if="!unsupported && !denied && !iosInstall" class="notif-prompt-actions">
        <button
          type="button"
          class="notif-btn notif-btn--primary"
          :disabled="loading"
          @click="onAutoriser"
        >
          {{ loading ? 'Activation…' : 'Autoriser les notifications' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-prompt {
  width: 100%;
}

.notif-prompt-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem 1.1rem;
  padding: 1rem 1.15rem;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--taupe) 75%, var(--brown));
  border-radius: 18px;
  box-shadow: var(--shadow);
}

.notif-prompt-inner--success {
  background: color-mix(in srgb, var(--teal) 14%, var(--surface));
  border-color: color-mix(in srgb, var(--teal) 55%, var(--taupe));
}

.notif-prompt-icon {
  margin: 0;
  font-size: 1.55rem;
  line-height: 1;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--teal) 18%, var(--cream));
  color: var(--ink);
}

.notif-prompt-inner--success .notif-prompt-icon {
  background: var(--teal);
  color: var(--cream);
}

.notif-prompt-text {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.notif-prompt-text strong {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--ink);
}

.notif-prompt-text span {
  font-size: 0.9rem;
  color: var(--text-soft);
  line-height: 1.45;
}

.notif-prompt-text code {
  font-size: 0.82em;
  padding: 0.05em 0.35em;
  border-radius: 6px;
  background: color-mix(in srgb, var(--taupe) 45%, white);
}

.notif-device-name {
  display: grid;
  gap: 0.3rem;
  margin-top: 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--brown);
}

.notif-device-name input {
  width: 100%;
  max-width: 280px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 0.75rem;
  background: var(--cream);
  color: var(--ink);
  font-size: 16px;
}

.notif-prompt-actions {
  display: flex;
  flex-shrink: 0;
  width: min(100%, 280px);
}

.notif-btn {
  border: none;
  border-radius: 12px;
  padding: 0.85rem 1.15rem;
  min-height: 44px;
  width: 100%;
  font-size: 0.95rem;
  font-weight: 700;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

@media (max-width: 720px) {
  .notif-prompt-inner {
    flex-direction: column;
    align-items: stretch;
    padding: 1rem 1rem 1.1rem;
    border-radius: 16px;
  }

  .notif-prompt-text {
    min-width: 0;
  }

  .notif-prompt-actions,
  .notif-device-name input {
    max-width: none;
    width: 100%;
  }
}

.notif-device-name input:focus {
  outline: 2px solid color-mix(in srgb, var(--teal) 70%, white);
  outline-offset: 1px;
}

.notif-prompt-error {
  width: 100%;
  margin: 0;
  font-size: 0.82rem;
  color: #8a3d32;
  font-weight: 600;
}

.notif-btn--primary {
  background: var(--teal);
  color: var(--cream);
  box-shadow: 0 8px 18px -10px var(--teal);
}

.notif-btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.notif-btn--primary:disabled {
  opacity: 0.65;
  cursor: wait;
}

.notif-btn--ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--teal) 45%, var(--taupe));
}
</style>
