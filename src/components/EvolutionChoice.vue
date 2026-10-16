<script setup>
import { starterArtworkUrl } from '../services/pokeapi.js'

defineProps({
  title: { type: String, default: 'Ton équipe' },
  slots: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  waitingFriend: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['choose'])

function displayName(slot) {
  return slot.choice?.name || slot.options?.[0]?.name || slot.fromName || '…'
}

function displayArt(slot) {
  return (
    slot.choice?.artwork ||
    slot.options?.find((option) => option.pokemonId === slot.choice?.pokemonId)?.artwork ||
    slot.options?.[0]?.artwork ||
    starterArtworkUrl(slot.choice?.pokemonId || slot.fromId)
  )
}

function canChoose(slot) {
  return !slot.readonly && !slot.auto && !slot.locked && (slot.options || []).length > 1
}
</script>

<template>
  <section class="evo" :aria-labelledby="title.replace(/\s+/g, '-').toLowerCase()">
    <h3>{{ title }}</h3>
    <p v-if="!readonly" class="dex-desc">
      Une ligne, les formes finales. Un Pokémon déjà au dernier stade reste celui-là.
    </p>
    <p v-if="waitingFriend" class="hint">En attente des choix de ton ami…</p>

    <ul class="evo-row">
      <li v-for="slot in slots" :key="slot.index" class="evo-slot">
        <p v-if="slot.loading" class="hint">…</p>
        <p v-else-if="slot.error" class="error">!</p>
        <template v-else>
          <img :src="displayArt(slot)" :alt="displayName(slot)" />
          <span class="name">{{ displayName(slot) }}</span>
          <small v-if="slot.pending" class="pending">Attente</small>
          <div v-if="canChoose(slot)" class="evo-options">
            <button
              v-for="option in slot.options"
              :key="option.pokemonId"
              type="button"
              class="evo-card"
              :class="{ 'evo-card--on': slot.choice?.pokemonId === option.pokemonId }"
              :disabled="saving"
              :title="option.name"
              @click="emit('choose', slot.index, option)"
            >
              <img :src="option.artwork || starterArtworkUrl(option.pokemonId)" :alt="option.name" />
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.evo {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1rem 1.05rem 1.1rem;
  box-shadow: var(--shadow);
}

.dex-desc,
.hint {
  color: var(--text-soft);
}

h3 {
  margin: 0;
  font-size: 1.05rem;
}

.dex-desc {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
}

.hint {
  margin: 0.45rem 0 0;
}

.error {
  color: #8a3d32;
  font-weight: 600;
}

.evo-row {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.2rem;
  overflow: hidden;
}

.evo-slot {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  text-align: center;
}

.evo-slot > img {
  width: 100%;
  max-width: 48px;
  height: 48px;
  object-fit: contain;
}

.name {
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.15;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.pending {
  color: var(--text-soft);
  font-size: 0.68rem;
}

.evo-options {
  display: flex;
  justify-content: center;
  gap: 0.18rem;
  flex-wrap: wrap;
}

.evo-card {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
  overflow: hidden;
}

.evo-card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.evo-card--on {
  outline: 2px solid var(--teal);
  background: color-mix(in srgb, var(--teal) 16%, var(--surface));
}

@media (max-width: 720px) {
  .evo {
    padding: 0.7rem 0.5rem 0.8rem;
    border-radius: 16px;
  }

  .dex-desc {
    font-size: 0.8rem;
  }

  .evo-row {
    gap: 0.12rem;
  }

  .evo-slot > img {
    max-width: 40px;
    height: 40px;
  }

  .name {
    font-size: 0.55rem;
  }

  .evo-card {
    width: 18px;
    height: 18px;
  }
}
</style>
