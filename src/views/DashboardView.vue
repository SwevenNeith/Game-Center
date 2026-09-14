<script setup>
import { games } from '../services/games.js'

function gameCardStyle(game) {
  const theme = game.theme || {}
  return {
    '--game-bg': theme.background || 'var(--surface-muted)',
    '--game-accent': theme.accent || 'var(--brown)',
    '--game-text': theme.text || 'var(--ink)',
  }
}
</script>

<template>
  <div class="dashboard">
    <section class="games-section" aria-labelledby="games-title">
      <div class="section-heading">
        <p class="eyebrow">Ludothèque</p>
        <h2 id="games-title">Tous les jeux</h2>
        <p class="lede">
          Chaque jeu aura sa propre charte graphique. La liste se remplira au fur et à mesure.
        </p>
      </div>

      <div v-if="games.length" class="games-grid">
        <article
          v-for="game in games"
          :key="game.id"
          class="game-card"
          :class="{ 'game-card--soon': game.status === 'coming_soon' }"
          :style="gameCardStyle(game)"
        >
          <p class="game-card__status">
            {{ game.status === 'coming_soon' ? 'Bientôt' : 'Jouer' }}
          </p>
          <h3>{{ game.name }}</h3>
          <p>{{ game.description }}</p>
        </article>
      </div>

      <div v-else class="empty-library" role="status">
        <div class="empty-library__preview" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <h3>En construction</h3>
        <p>Aucun jeu n’est encore disponible. La ludothèque se construit ici, jeu après jeu.</p>
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
.game-card h3 {
  font-family: var(--display);
  color: var(--ink);
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--brown);
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.2rem);
  font-weight: 600;
}

.lede {
  margin: 0.4rem 0 0;
  max-width: 42rem;
  color: var(--text-soft);
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.game-card {
  min-height: 180px;
  padding: 1.1rem 1.15rem;
  border-radius: 20px;
  background: var(--game-bg);
  color: var(--game-text);
  border: 1px solid color-mix(in srgb, var(--game-accent) 45%, transparent);
  box-shadow: var(--shadow);
}

.game-card__status {
  margin: 0 0 1rem;
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--game-accent) 18%, white);
  color: var(--game-accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-card h3 {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
}

.game-card p {
  margin: 0;
  color: color-mix(in srgb, var(--game-text) 78%, white);
}

.empty-library {
  margin-top: 1.25rem;
  padding: 2rem 1.4rem;
  border-radius: 24px;
  text-align: center;
  background: var(--surface);
  border: 1px dashed color-mix(in srgb, var(--taupe) 70%, var(--brown));
}

.empty-library__preview {
  display: flex;
  justify-content: center;
  gap: 0.7rem;
  margin-bottom: 1.2rem;
}

.empty-library__preview span {
  width: 72px;
  height: 92px;
  border-radius: 14px;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--taupe) 55%, white),
    color-mix(in srgb, var(--brown) 28%, var(--cream))
  );
  opacity: 0.7;
}

.empty-library__preview span:nth-child(2) {
  transform: translateY(-8px);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--teal) 35%, var(--cream)),
    var(--taupe)
  );
}

.empty-library h3 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.empty-library p {
  margin: 0 auto;
  max-width: 28rem;
  color: var(--text-soft);
}

@media (max-width: 720px) {
  .empty-library {
    padding: 1.4rem 1rem;
    border-radius: 18px;
  }

  .empty-library__preview {
    gap: 0.5rem;
  }

  .empty-library__preview span {
    width: 56px;
    height: 74px;
  }

  .empty-library__preview span:nth-child(3) {
    display: none;
  }

  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
