<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import JoinInviteForm from '../components/JoinInviteForm.vue'
import { games } from '../services/games.js'
import {
  fetchActiveInviteForDevice,
  purgeExpiredInvites,
  resumeSummary,
  STARTER_GAME_ID,
} from '../services/invites.js'

const resumeInvite = ref(null)
const resumeLabel = computed(() => resumeSummary(resumeInvite.value))

onMounted(async () => {
  await purgeExpiredInvites()
  const result = await fetchActiveInviteForDevice(STARTER_GAME_ID)
  if (result.success) resumeInvite.value = result.invite
})
</script>

<template>
  <div class="dashboard">
    <JoinInviteForm />

    <section v-if="resumeInvite" class="resume-card" aria-labelledby="resume-title">
      <p class="eyebrow">Partie en cours</p>
      <h2 id="resume-title">Reprendre Starter à l’aveugle</h2>
      <p class="resume-card__desc">
        Tu as quitté une partie. Tu peux y revenir sans perdre la progression.
        <span v-if="resumeLabel"> {{ resumeLabel }}.</span>
      </p>
      <RouterLink
        class="resume-btn"
        :to="{ path: '/starter-aveugle', query: { code: resumeInvite.code } }"
      >
        Reprendre la partie
      </RouterLink>
    </section>

    <section class="games-section" aria-labelledby="games-title">
      <div class="section-heading">
        <p class="eyebrow eyebrow--brown">Ludothèque</p>
        <h2 id="games-title">Tous les jeux</h2>
      </div>

      <div v-if="games.length" class="games-grid">
        <RouterLink
          v-for="game in games"
          :key="game.id"
          :to="game.to || '/'"
          class="game-card"
          :class="{ 'game-card--soon': game.status === 'coming_soon' }"
        >
          <div class="game-card__cover" aria-hidden="true">
            <img v-if="game.image" :src="game.image" :alt="''" />
            <span v-else class="game-card__placeholder">?</span>
          </div>
          <p class="game-card__status">
            {{ game.status === 'coming_soon' ? 'Bientôt' : 'Jouer' }}
          </p>
          <h3>{{ game.name }}</h3>
          <p class="game-card__desc">{{ game.description }}</p>
        </RouterLink>
      </div>

      <div v-else class="empty-library" role="status">
        <h3>En construction</h3>
        <p>Aucun jeu n’est encore disponible.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 1.5rem;
}

.section-heading h2,
.empty-library h3,
.game-card h3,
.resume-card h2 {
  font-family: var(--display);
  color: inherit;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

.eyebrow--brown {
  color: var(--brown);
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.2rem);
  font-weight: 600;
  color: var(--ink);
}

.resume-card {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--teal) 45%, var(--taupe));
  border-radius: 22px;
  padding: 1.15rem 1.2rem 1.25rem;
  box-shadow: var(--shadow);
}

.resume-card h2 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 600;
}

.resume-card__desc {
  margin: 0.35rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.resume-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-top: 0.95rem;
  padding: 0.7rem 1.1rem;
  border-radius: 12px;
  background: var(--teal);
  color: var(--cream);
  font-weight: 700;
  text-decoration: none;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.game-card {
  min-height: 180px;
  padding: 1.1rem 1.15rem 1.2rem;
  border-radius: 20px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  text-decoration: none;
  display: flex;
  flex-direction: column;
}

.game-card__cover {
  height: 92px;
  border-radius: 14px;
  margin-bottom: 0.85rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--teal) 22%, var(--taupe));
  display: grid;
  place-items: center;
}

.game-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-card__placeholder {
  font-family: var(--display);
  font-size: 2rem;
  color: var(--cream);
  opacity: 0.85;
}

.game-card__status {
  margin: 0 0 0.55rem;
  display: inline-flex;
  width: fit-content;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--teal) 16%, white);
  color: var(--teal);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-card h3 {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
}

.game-card__desc {
  margin: 0;
  color: var(--text-soft);
}

.empty-library {
  margin-top: 1.25rem;
  padding: 2rem 1.4rem;
  border-radius: 24px;
  text-align: center;
  background: var(--surface);
  border: 1px dashed color-mix(in srgb, var(--taupe) 70%, var(--brown));
  color: var(--ink);
}

@media (max-width: 720px) {
  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
