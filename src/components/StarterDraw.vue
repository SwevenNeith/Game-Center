<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const emit = defineEmits(['pick', 'start-lie', 'place-lie', 'change-lie', 'cancel-lie'])
const focusedId = ref(null)
const pendingId = ref(null)

const pendingPokemon = computed(
  () => props.pokemon.find((item) => Number(item.id) === Number(pendingId.value)) || null,
)

watch(
  () => [props.pickedId, props.pokemon.map((item) => item.id).join(',')].join('|'),
  () => {
    pendingId.value = null
  },
)

function pokeName(item) {
  if (!item) return '…'
  return props.detailsById[item.id]?.name || item.fr || item.en || `#${item.id}`
}

function canPick() {
  return !props.disabled && !props.waiting && !props.pickedId
}

function highlightedId(id) {
  return Number(props.pickedId || pendingId.value || focusedId.value) === Number(id)
}

function onCardClick(id, event) {
  if (event?.target?.closest('button, audio, a')) return
  if (props.assigningLie) {
    emit('place-lie', id)
    return
  }
  focusedId.value = id
}

function askPick(id) {
  if (!canPick()) return
  focusedId.value = id
  pendingId.value = id
}

function cancelPick() {
  pendingId.value = null
}

function submitPick() {
  const id = pendingId.value
  if (!canPick() || !id) return
  pendingId.value = null
  emit('pick', id)
}

function onKeydown(event) {
  if (event.key === 'Escape' && pendingId.value) cancelPick()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="draw" aria-labelledby="draw-title">
    <p class="draw-round">Manche {{ round }} / {{ TOTAL_ROUNDS }}</p>
    <h3 id="draw-title">Voici les propositions pour {{ friendName }}</h3>
    <p class="draw-desc">
      Regarde les 3 propositions, puis valide avec <strong>Je prends celui-là</strong> pour éviter un clic
      trop rapide. Sans méga, primo-forme ni Gigamax.
    </p>
    <p v-if="assigningLie" class="draw-hint draw-hint--lie">
      Sélectionne l’un des 3 Pokémon : le mensonge s’affichera en dessous, en rouge. Tu ne pourras pas le choisir pour l’équipe.
    </p>

    <p v-if="loading && !pokemon.length" class="draw-hint">Tirage en cours…</p>

    <ul v-else class="draw-grid">
      <li v-for="item in pokemon" :key="item.id">
        <article
          class="pick-card"
          :class="{
            'pick-card--selected': highlightedId(item.id),
            'pick-card--target': assigningLie,
            'pick-card--locked': !assigningLie && (disabled || waiting || Boolean(pickedId)) && pickedId !== item.id,
          }"
          @click="onCardClick(item.id, $event)"
        >
          <img :src="starterArtworkUrl(item.id)" :alt="pokeName(item)" />
          <p class="pick-name">{{ pokeName(item) }}</p>
          <PokemonPreviewInfo :pokemon="detailsById[item.id]" :flags="flags" />
          <button
            v-if="!assigningLie && !pickedId"
            type="button"
            class="confirm-btn"
            :disabled="disabled || waiting"
            @click.stop="askPick(item.id)"
          >
            Je prends celui-là
          </button>
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
          <button
            v-if="!pickedId"
            type="button"
            class="lie-change"
            @click.stop="emit('change-lie')"
          >
            Changer ce mensonge
          </button>
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
    <button
      v-else-if="lie && !pickedId && !searchingLie && !assigningLie"
      type="button"
      class="lie-btn lie-btn--change"
      @click="emit('change-lie')"
    >
      Changer le mensonge
    </button>
    <button
      v-else-if="assigningLie && !pickedId"
      type="button"
      class="lie-btn lie-btn--change"
      @click="emit('cancel-lie')"
    >
      Annuler le mensonge
    </button>

    <div v-if="searchingLie && !lie" class="lie-search">
      <slot name="lie-search" />
    </div>

    <p v-if="pickedId && waiting" class="draw-hint">
      Choix envoyé. En attente de {{ friendName }}…
    </p>

    <Teleport to="body">
      <div
        v-if="pendingPokemon"
        class="pick-modal"
        role="presentation"
        @click.self="cancelPick"
      >
        <div
          class="pick-modal__box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pick-modal-title"
        >
          <h4 id="pick-modal-title">Tu es sûr ?</h4>
          <img :src="starterArtworkUrl(pendingPokemon.id)" :alt="pokeName(pendingPokemon)" />
          <p class="pick-modal__name">{{ pokeName(pendingPokemon) }}</p>
          <p class="pick-modal__text">
            Tu vas ajouter <strong>{{ pokeName(pendingPokemon) }}</strong> à l’équipe de
            {{ friendName }}.
          </p>
          <div class="pick-modal__actions">
            <button type="button" class="confirm-btn confirm-btn--modal" @click="submitPick">
              Oui, je prends {{ pokeName(pendingPokemon) }}
            </button>
            <button type="button" class="cancel-btn" @click="cancelPick">Annuler</button>
          </div>
        </div>
      </div>
    </Teleport>
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

.confirm-btn {
  width: 100%;
  margin-top: 0.75rem;
  border: none;
  border-radius: 14px;
  min-height: 48px;
  padding: 0.55rem 0.8rem;
  background: var(--teal);
  color: var(--cream);
  font-size: 1rem;
  font-weight: 800;
}

.pick-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.1rem;
  background: color-mix(in srgb, var(--ink) 52%, transparent);
}

.pick-modal__box {
  width: min(26rem, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.2rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
  text-align: center;
}

.pick-modal__box h4 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.45rem;
}

.pick-modal__box img {
  display: block;
  margin: 0.85rem auto 0;
  width: min(100%, 180px);
  height: 160px;
  object-fit: contain;
}

.pick-modal__name {
  margin: 0.2rem 0 0;
  font-size: 1.35rem;
  font-weight: 800;
}

.pick-modal__text {
  margin: 0.45rem 0 0;
  color: var(--text-soft);
}

.pick-modal__actions {
  margin-top: 0.95rem;
  display: grid;
  gap: 0.5rem;
}

.confirm-btn--modal {
  margin-top: 0;
}

.cancel-btn {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  min-height: 44px;
  padding: 0.45rem 0.8rem;
  background: var(--surface-muted);
  color: var(--ink);
  font-weight: 700;
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

.lie-btn--change,
.lie-change {
  background: var(--surface-muted);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, #8a3d32 45%, var(--border));
}

.lie-change {
  width: 100%;
  margin-top: 0.7rem;
  border-radius: 12px;
  min-height: 40px;
  padding: 0 0.75rem;
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

  .confirm-btn {
    min-height: 52px;
    font-size: 1.05rem;
  }
}
</style>
