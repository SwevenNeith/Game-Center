<script setup>
import { reactive, watch } from 'vue'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  title: { type: String, default: 'Ton équipe' },
  slots: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  waitingFriend: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['choose'])
const pendingByIndex = reactive({})

watch(
  () =>
    props.slots.map((slot) => `${slot.index}:${slot.choice?.pokemonId || ''}:${(slot.options || []).length}`).join('|'),
  () => {
    for (const slot of props.slots) {
      const pending = pendingByIndex[slot.index]
      if (pending && pending.pokemonId === slot.choice?.pokemonId) delete pendingByIndex[slot.index]
    }
  },
)

function displayChoice(slot) {
  return pendingByIndex[slot.index] || slot.choice || slot.options?.[0] || null
}

function displayName(slot) {
  const chosen = displayChoice(slot)
  return chosen?.name || chosen?.fr || slot.fromName || '…'
}

function displayArt(slot) {
  const choice = displayChoice(slot)
  return (
    choice?.artwork ||
    slot.options?.find((option) => option.pokemonId === choice?.pokemonId)?.artwork ||
    slot.options?.[0]?.artwork ||
    starterArtworkUrl(choice?.pokemonId || slot.fromId)
  )
}

function canChoose(slot) {
  if (props.readonly || slot.readonly || slot.auto || slot.locked) return false
  if (slot.choice?.pokemonId) return false
  return (slot.options || []).length > 1
}

function isOn(slot, option) {
  const current = pendingByIndex[slot.index] || slot.choice
  return current?.pokemonId === option.pokemonId
}

function selectOption(slot, option) {
  if (!canChoose(slot) || props.saving) return
  pendingByIndex[slot.index] = option
}

function canConfirm(slot) {
  const pending = pendingByIndex[slot.index]
  if (!pending || props.saving) return false
  return pending.pokemonId !== slot.choice?.pokemonId
}

function confirmOption(slot) {
  const option = pendingByIndex[slot.index]
  if (!option || !canConfirm(slot)) return
  emit('choose', slot.index, option)
}
</script>

<template>
  <section class="evo" :aria-labelledby="title.replace(/\s+/g, '-').toLowerCase()">
    <h3>{{ title }}</h3>
    <p v-if="!readonly" class="dex-desc">
      Une forme déjà finale reste celle-là. S’il y a plusieurs évolutions, le choix est
      <strong>définitif</strong> : <strong>Je prends celui-là</strong> verrouille le Pokémon.
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
          <small v-else-if="!canChoose(slot) && !readonly" class="pending">Verrouillé</small>
          <div v-if="canChoose(slot)" class="evo-options">
            <button
              v-for="option in slot.options"
              :key="option.pokemonId"
              type="button"
              class="evo-card"
              :class="{ 'evo-card--on': isOn(slot, option) }"
              :disabled="saving"
              :title="option.name"
              @click="selectOption(slot, option)"
            >
              <img :src="option.artwork || starterArtworkUrl(option.pokemonId)" :alt="option.name" />
              <span>{{ option.name }}</span>
            </button>
          </div>
          <button
            v-if="canConfirm(slot)"
            type="button"
            class="confirm-btn"
            :disabled="saving"
            @click="confirmOption(slot)"
          >
            Je prends <span class="nobr">celui-là</span>
          </button>
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
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.55rem;
  overflow: hidden;
}

.evo-slot {
  min-width: 0;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.28rem;
  text-align: center;
}

.evo-slot > img {
  width: 100%;
  max-width: 84px;
  height: 84px;
  object-fit: contain;
}

.name {
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.pending {
  color: var(--text-soft);
  font-size: 0.72rem;
}

.evo-options {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  width: 100%;
}

.evo-card {
  flex: 1 1 3.4rem;
  min-width: 3.2rem;
  max-width: 5.2rem;
  min-height: 4.4rem;
  padding: 0.25rem 0.2rem 0.35rem;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--surface-muted);
  display: grid;
  justify-items: center;
  gap: 0.12rem;
}

.evo-card img {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.evo-card span {
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1.15;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.evo-card--on {
  border-color: var(--teal);
  outline: 2px solid var(--teal);
  background: color-mix(in srgb, var(--teal) 16%, var(--surface));
}

.confirm-btn {
  width: 100%;
  margin-top: 0.15rem;
  border: none;
  border-radius: 10px;
  min-height: 40px;
  padding: 0.3rem 0.35rem;
  background: var(--teal);
  color: var(--cream);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.15;
  hyphens: none;
}

.nobr {
  white-space: nowrap;
}

@media (max-width: 720px) {
  .evo {
    padding: 0.85rem 0.6rem 0.95rem;
    border-radius: 16px;
  }

  .dex-desc {
    font-size: 0.84rem;
  }

  .evo-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem 0.4rem;
  }

  .evo-slot > img {
    max-width: 92px;
    height: 92px;
  }

  .name {
    font-size: 0.82rem;
  }

  .evo-card {
    min-height: 4.6rem;
  }

  .evo-card img {
    width: 48px;
    height: 48px;
  }

  .evo-card span {
    font-size: 0.68rem;
  }

  .confirm-btn {
    min-height: 44px;
    font-size: 0.78rem;
  }
}
</style>
