<script setup>
import { starterArtworkUrl } from '../services/pokeapi.js'
import { TOTAL_ROUNDS } from '../services/starterAveugle.js'

defineProps({
  pokemon: { type: Array, default: () => [] },
  friendName: { type: String, default: '' },
  round: { type: Number, default: 1 },
  pickedId: { type: Number, default: null },
  waiting: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['pick'])
</script>

<template>
  <section class="draw" aria-labelledby="draw-title">
    <p class="draw-round">Manche {{ round }} / {{ TOTAL_ROUNDS }}</p>
    <h3 id="draw-title">Voici les propositions pour {{ friendName }}</h3>
    <p class="draw-desc">Choisis-en un : il sera ajouté à son équipe. Sans méga, primo-forme ni Gigamax.</p>

    <p v-if="loading && !pokemon.length" class="draw-hint">Tirage en cours…</p>

    <ul v-else class="draw-grid">
      <li v-for="item in pokemon" :key="item.id">
        <button
          type="button"
          class="pick-card"
          :class="{ 'pick-card--selected': pickedId === item.id }"
          :disabled="disabled || waiting || Boolean(pickedId)"
          @click="emit('pick', item.id)"
        >
          <img :src="starterArtworkUrl(item.id)" :alt="item.fr || item.en" />
          <p class="num">#{{ String(item.id).padStart(4, '0') }}</p>
          <strong>{{ item.fr || item.en }}</strong>
        </button>
      </li>
    </ul>

    <p v-if="pickedId && waiting" class="draw-hint">
      Choix envoyé. En attente de {{ friendName }}…
    </p>
  </section>
</template>

<style scoped>
.draw {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
}

.draw-round {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

h3 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.draw-desc,
.draw-hint {
  margin: 0.3rem 0 0;
  color: var(--text-soft);
}

.draw-hint {
  font-size: 0.88rem;
  font-weight: 600;
}

.draw-grid {
  list-style: none;
  margin: 0.95rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.pick-card {
  width: 100%;
  background: var(--surface-muted);
  border: 2px solid transparent;
  border-radius: 16px;
  padding: 0.7rem 0.55rem 0.85rem;
  text-align: center;
  min-height: 44px;
}

.pick-card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--teal) 45%, var(--taupe));
}

.pick-card--selected {
  border-color: var(--teal);
  background: color-mix(in srgb, var(--teal) 12%, var(--surface));
}

.pick-card:disabled:not(.pick-card--selected) {
  opacity: 0.55;
}

.pick-card img {
  margin: 0 auto;
  max-height: 110px;
}

.num {
  margin: 0.25rem 0 0;
  font-weight: 700;
  color: var(--teal);
  font-size: 0.78rem;
}

strong {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.92rem;
}

@media (max-width: 720px) {
  .draw-grid {
    grid-template-columns: 1fr;
  }
}
</style>
