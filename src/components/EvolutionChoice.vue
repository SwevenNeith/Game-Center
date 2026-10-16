<script setup>
import { starterArtworkUrl } from '../services/pokeapi.js'

defineProps({
  slots: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  waitingFriend: { type: Boolean, default: false },
})

const emit = defineEmits(['choose'])
</script>

<template>
  <section class="evo" aria-labelledby="evo-title">
    <h3 id="evo-title">Évolutions finales</h3>
    <p class="dex-desc">
      Chaque Pokémon passe à son dernier stade. S’il y a plusieurs possibilités, choisis-en une.
    </p>
    <p v-if="waitingFriend" class="hint">En attente des choix de ton ami…</p>

    <ul class="evo-list">
      <li v-for="slot in slots" :key="slot.index">
        <div class="evo-from">
          <img :src="starterArtworkUrl(slot.fromId)" alt="" />
          <span>{{ slot.fromName }}</span>
        </div>
        <p v-if="slot.loading" class="hint">Chargement des évolutions…</p>
        <p v-else-if="slot.error" class="error">{{ slot.error }}</p>
        <div v-else class="evo-options">
          <button
            v-for="option in slot.options"
            :key="option.pokemonId"
            type="button"
            class="evo-card"
            :class="{ 'evo-card--on': slot.choice?.pokemonId === option.pokemonId }"
            :disabled="saving || Boolean(slot.auto)"
            @click="emit('choose', slot.index, option)"
          >
            <img :src="option.artwork || starterArtworkUrl(option.pokemonId)" :alt="option.name" />
            <span>{{ option.name }}</span>
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.evo {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem;
  box-shadow: var(--shadow);
}

.dex-desc,
.hint {
  color: var(--text-soft);
}

.hint {
  margin: 0.5rem 0 0;
}

.error {
  color: #8a3d32;
  font-weight: 600;
}

.evo-list {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.evo-from {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

.evo-from img {
  width: 40px;
  height: 40px;
}

.evo-options {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.evo-card {
  width: 104px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-muted);
  padding: 0.45rem;
  display: grid;
  gap: 0.25rem;
  justify-items: center;
  font-size: 0.82rem;
}

.evo-card img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}

.evo-card--on {
  outline: 2px solid var(--teal);
  background: color-mix(in srgb, var(--teal) 16%, var(--surface));
}
</style>
