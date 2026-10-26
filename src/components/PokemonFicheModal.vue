<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PokemonFiche from './PokemonFiche.vue'

const props = defineProps({
  pokemon: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'open'])
const box = ref(null)

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.pokemon?.id,
  async () => {
    await nextTick()
    box.value?.scrollTo({ top: 0 })
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="sheet" role="presentation" @click.self="emit('close')">
      <div
        ref="box"
        class="sheet__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiche-modal-title"
      >
        <header class="sheet__bar">
          <h4 id="fiche-modal-title">Fiche Pokédex</h4>
          <button type="button" class="sheet__close" @click="emit('close')">Fermer</button>
        </header>
        <p v-if="loading" class="sheet__hint">Chargement de la fiche…</p>
        <p v-else-if="error" class="sheet__error">{{ error }}</p>
        <PokemonFiche v-if="pokemon" compact :pokemon="pokemon" @open="emit('open', $event)" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: max(0.6rem, env(safe-area-inset-top)) 0.7rem max(0.8rem, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--ink) 52%, transparent);
}

.sheet__box {
  width: min(44rem, 100%);
  max-height: min(92dvh, 920px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 0.85rem 0.95rem 1.15rem;
  box-shadow: var(--shadow);
  -webkit-overflow-scrolling: touch;
}

.sheet__bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  margin: -0.85rem -0.95rem 0.7rem;
  padding: 0.75rem 0.95rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.sheet__bar h4 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.2rem;
}

.sheet__close {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--ink);
  font-weight: 700;
}

.sheet__hint,
.sheet__error {
  margin: 0.4rem 0 0;
}

.sheet__error {
  color: #8a3d32;
  font-weight: 600;
}

@media (max-width: 720px) {
  .sheet {
    padding: 0;
    place-items: stretch;
  }

  .sheet__box {
    width: 100%;
    max-height: none;
    height: 100%;
    border-radius: 0;
    padding: calc(0.55rem + env(safe-area-inset-top, 0px)) 0.85rem
      calc(1rem + env(safe-area-inset-bottom, 0px));
  }

  .sheet__bar {
    margin: calc(-0.55rem - env(safe-area-inset-top, 0px)) -0.85rem 0.7rem;
    padding: calc(0.55rem + env(safe-area-inset-top, 0px)) 0.85rem 0.7rem;
  }
}
</style>
