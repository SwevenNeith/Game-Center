<script setup>
import PokemonPreviewInfo from './PokemonPreviewInfo.vue'
import { starterArtworkUrl } from '../services/pokeapi.js'
import { TOTAL_ROUNDS } from '../services/starterAveugle.js'

defineProps({
  pokemon: { type: Array, default: () => [] },
  detailsById: { type: Object, default: () => ({}) },
  flags: { type: Object, default: () => ({}) },
  friendName: { type: String, default: '' },
  round: { type: Number, default: 1 },
  pickedId: { type: Number, default: null },
  waiting: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  lie: { type: Object, default: null },
  lieUnderId: { type: Number, default: null },
  searchingLie: { type: Boolean, default: false },
  assigningLie: { type: Boolean, default: false },
})

const emit = defineEmits(['pick', 'start-lie', 'place-lie'])

function onCardClick(id) {
  emit('pick', id)
}

function onPlace(id) {
  emit('place-lie', id)
}
</script>

<template>
  <section class="draw" aria-labelledby="draw-title">
    <p class="draw-round">Manche {{ round }} / {{ TOTAL_ROUNDS }}</p>
    <h3 id="draw-title">Voici les propositions pour {{ friendName }}</h3>
    <p class="draw-desc">Choisis-en un : il sera ajouté à son équipe. Sans méga, primo-forme ni Gigamax.</p>
    <p v-if="assigningLie" class="draw-hint draw-hint--lie">
      Sélectionne l’un des 3 Pokémon : le mensonge s’affichera en dessous, en rouge. Tu ne pourras pas le choisir pour l’équipe.
    </p>

    <p v-if="loading && !pokemon.length" class="draw-hint">Tirage en cours…</p>

    <ul v-else class="draw-grid">
      <li v-for="item in pokemon" :key="item.id">
        <button
          type="button"
          class="pick-card"
          :class="{
            'pick-card--selected': pickedId === item.id,
            'pick-card--target': assigningLie,
          }"
          :disabled="assigningLie ? false : disabled || waiting || Boolean(pickedId)"
          @click="assigningLie ? onPlace(item.id) : onCardClick(item.id)"
        >
          <img :src="starterArtworkUrl(item.id)" alt="" />
          <PokemonPreviewInfo :pokemon="detailsById[item.id]" :flags="flags" />
        </button>

        <article
          v-if="lie && lieUnderId === item.id"
          class="pick-card pick-card--lie"
          aria-label="Pokémon mensonge"
        >
          <p class="lie-tag">Mensonge</p>
          <img :src="starterArtworkUrl(lie.id)" alt="" />
          <PokemonPreviewInfo :pokemon="detailsById[lie.id]" :flags="flags" />
        </article>
      </li>
    </ul>

    <button
      v-if="!lie && !pickedId && !searchingLie && !assigningLie && pokemon.length === 3"
      type="button"
      class="lie-btn"
      @click="emit('start-lie')"
    >
      Choisir un mensonge
    </button>

    <div v-if="searchingLie && !lie" class="lie-search">
      <slot name="lie-search" />
    </div>

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

.draw-hint--lie {
  color: #8a3d32;
}

.draw-grid {
  list-style: none;
  margin: 0.95rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.draw-grid li {
  display: grid;
  gap: 0.55rem;
  align-content: start;
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

.pick-card--target {
  border-color: color-mix(in srgb, #8a3d32 55%, var(--taupe));
  cursor: pointer;
}

.pick-card--lie {
  background: color-mix(in srgb, #8a3d32 12%, var(--surface));
  border-color: #8a3d32;
  cursor: default;
}

.pick-card:disabled:not(.pick-card--selected) {
  opacity: 0.55;
}

.pick-card img {
  margin: 0 auto;
  max-height: 110px;
}

.lie-tag {
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: #8a3d32;
}

.lie-btn {
  width: 100%;
  margin-top: 0.9rem;
  border: none;
  border-radius: 12px;
  min-height: 44px;
  padding: 0 1rem;
  background: color-mix(in srgb, #8a3d32 86%, var(--ink));
  color: var(--cream);
  font-weight: 700;
}

.lie-search {
  margin-top: 0.9rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--border);
}

@media (max-width: 720px) {
  .draw-grid {
    grid-template-columns: 1fr;
  }
}
</style>
