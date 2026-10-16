<script setup>
import PokemonPreviewInfo from './PokemonPreviewInfo.vue'
import { starterArtworkUrl } from '../services/pokeapi.js'
import { TOTAL_ROUNDS } from '../services/starterAveugle.js'

const props = defineProps({
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

function pokeName(item) {
  if (!item) return '…'
  return props.detailsById[item.id]?.name || item.fr || item.en || `#${item.id}`
}

function canSelect() {
  return !props.disabled && !props.waiting && !props.pickedId
}

function onCardClick(id, event) {
  if (event?.target?.closest('button.cry-btn, audio, a')) return
  if (props.assigningLie) {
    emit('place-lie', id)
    return
  }
  if (!canSelect()) return
  emit('pick', id)
}
</script>

<template>
  <section class="draw" aria-labelledby="draw-title">
    <p class="draw-round">Manche {{ round }} / {{ TOTAL_ROUNDS }}</p>
    <h3 id="draw-title">Voici les propositions pour {{ friendName }}</h3>
    <p class="draw-desc">Touche un Pokémon pour l’ajouter à son équipe. Sans méga, primo-forme ni Gigamax.</p>
    <p v-if="assigningLie" class="draw-hint draw-hint--lie">
      Sélectionne l’un des 3 Pokémon : le mensonge s’affichera en dessous, en rouge. Tu ne pourras pas le choisir pour l’équipe.
    </p>

    <p v-if="loading && !pokemon.length" class="draw-hint">Tirage en cours…</p>

    <ul v-else class="draw-grid">
      <li v-for="item in pokemon" :key="item.id">
        <article
          class="pick-card"
          :class="{
            'pick-card--selected': pickedId === item.id,
            'pick-card--target': assigningLie,
            'pick-card--locked': !assigningLie && (disabled || waiting || Boolean(pickedId)) && pickedId !== item.id,
          }"
          @click="onCardClick(item.id, $event)"
        >
          <img :src="starterArtworkUrl(item.id)" :alt="pokeName(item)" />
          <p class="pick-name">{{ pokeName(item) }}</p>
          <PokemonPreviewInfo :pokemon="detailsById[item.id]" :flags="flags" />
        </article>

        <article
          v-if="lie && lieUnderId === item.id"
          class="pick-card pick-card--lie"
          aria-label="Pokémon mensonge"
        >
          <p class="lie-tag">Mensonge</p>
          <img :src="starterArtworkUrl(lie.id)" :alt="pokeName(lie)" />
          <p class="pick-name">{{ pokeName(lie) }}</p>
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
  gap: 0.9rem;
}

.draw-grid li {
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.pick-card {
  width: 100%;
  background: var(--surface-muted);
  border: 3px solid transparent;
  border-radius: 20px;
  padding: 0.95rem 0.7rem 1rem;
  text-align: center;
  min-height: 48px;
  cursor: pointer;
}

.pick-card:hover:not(.pick-card--locked) {
  border-color: color-mix(in srgb, var(--teal) 45%, var(--taupe));
}

.pick-card--selected {
  border-color: var(--teal);
  background: color-mix(in srgb, var(--teal) 12%, var(--surface));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal) 28%, transparent);
}

.pick-card--target {
  border-color: color-mix(in srgb, #8a3d32 55%, var(--taupe));
}

.pick-card--lie {
  background: color-mix(in srgb, #8a3d32 12%, var(--surface));
  border-color: #8a3d32;
  cursor: default;
  box-shadow: none;
}

.pick-card--locked {
  opacity: 0.55;
  cursor: default;
}

.pick-card img {
  margin: 0 auto;
  width: min(100%, 180px);
  height: 150px;
  object-fit: contain;
}

.pick-name {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.2;
  word-break: break-word;
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
    gap: 1rem;
  }

  .pick-card {
    padding: 1.05rem 0.85rem 1.1rem;
  }

  .pick-card img {
    width: min(100%, 220px);
    height: 180px;
  }

  .pick-name {
    font-size: 1.15rem;
  }
}
</style>
