<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getGameById } from '../services/games.js'
import { joinInvite } from '../services/invites.js'

const router = useRouter()
const code = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function onJoin() {
  errorMessage.value = ''
  loading.value = true
  const result = await joinInvite(code.value)
  loading.value = false

  if (!result.success) {
    errorMessage.value = result.message
    return
  }

  const game = getGameById(result.invite.game_id)
  if (!game?.to) {
    errorMessage.value = 'Ce code pointe vers un jeu inconnu.'
    return
  }

  await router.push({
    path: game.to,
    query: { code: result.invite.code },
  })
}
</script>

<template>
  <section class="join-card" aria-labelledby="join-title">
      <p class="eyebrow">Invitation</p>
    <h2 id="join-title">Entrer un code</h2>
    <p class="join-card__desc">
      Un ami t’a invité ? Saisis son code (valable 5 minutes) pour rejoindre sa partie.
    </p>

    <form class="join-form" @submit.prevent="onJoin">
      <label class="sr-only" for="invite-code">Code d’invitation</label>
      <input
        id="invite-code"
        v-model="code"
        type="text"
        inputmode="text"
        autocomplete="off"
        maxlength="8"
        placeholder="ABC123"
        spellcheck="false"
      />
      <button type="submit" class="join-btn" :disabled="loading || code.trim().length < 4">
        {{ loading ? 'Vérification…' : 'Rejoindre' }}
      </button>
    </form>
    <p v-if="errorMessage" class="join-error">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.join-card {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--taupe) 80%, var(--brown));
  border-radius: 22px;
  padding: 1.15rem 1.2rem 1.25rem;
  box-shadow: var(--shadow);
}

.eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

h2 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.45rem;
  font-weight: 600;
}

.join-card__desc {
  margin: 0.35rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.join-form {
  display: flex;
  gap: 0.55rem;
  margin-top: 0.95rem;
}

.join-form input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  background: var(--cream);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  font-size: 16px;
}

.join-btn {
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  min-height: 44px;
  background: var(--teal);
  color: var(--cream);
  font-weight: 700;
  white-space: nowrap;
}

.join-btn:disabled {
  opacity: 0.6;
}

.join-error {
  margin: 0.65rem 0 0;
  color: #8a3d32;
  font-weight: 600;
  font-size: 0.88rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 720px) {
  .join-form {
    flex-direction: column;
  }
}
</style>
