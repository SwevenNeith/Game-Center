<script setup>
import { onMounted, onUnmounted } from 'vue'
import PokedexLoupe from './PokedexLoupe.vue'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  myName: { type: String, default: 'Toi' },
  friendName: { type: String, default: 'Ami' },
  myTeam: { type: Array, default: () => [] },
  theirTeam: { type: Array, default: () => [] },
  detailsById: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'inspect'])

function pokeName(item) {
  if (!item) return 'Emplacement vide'
  return props.detailsById[item.id]?.name || item.fr || item.en || `#${item.id}`
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="sheet" role="presentation" @click.self="emit('close')">
      <div class="sheet__box" role="dialog" aria-modal="true" aria-labelledby="teams-modal-title">
        <header class="sheet__bar">
          <h4 id="teams-modal-title">Équipes</h4>
          <button type="button" class="sheet__close" @click="emit('close')">Fermer</button>
        </header>

        <div class="split">
          <section>
            <h5>Ton équipe · {{ myName }}</h5>
            <p v-if="!myTeam.length" class="empty">Aucun Pokémon pour l’instant.</p>
            <ul v-else>
              <li v-for="item in myTeam" :key="`me-${item.id}`">
                <img :src="starterArtworkUrl(item.id)" :alt="pokeName(item)" />
                <span>{{ pokeName(item) }}</span>
                <PokedexLoupe :label="`Fiche de ${pokeName(item)}`" @click="emit('inspect', item.id)" />
              </li>
            </ul>
          </section>
          <section>
            <h5>Équipe de {{ friendName }}</h5>
            <p v-if="!theirTeam.length" class="empty">Aucun Pokémon pour l’instant.</p>
            <ul v-else>
              <li v-for="item in theirTeam" :key="`them-${item.id}`">
                <img :src="starterArtworkUrl(item.id)" :alt="pokeName(item)" />
                <span>{{ pokeName(item) }}</span>
                <PokedexLoupe :label="`Fiche de ${pokeName(item)}`" @click="emit('inspect', item.id)" />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet {
  position: fixed;
  inset: 0;
  z-index: 85;
  display: grid;
  place-items: center;
  padding: max(0.6rem, env(safe-area-inset-top)) 0.7rem max(0.8rem, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--ink) 52%, transparent);
}

.sheet__box {
  width: min(40rem, 100%);
  max-height: min(92dvh, 860px);
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
  margin: -0.85rem -0.95rem 0.85rem;
  padding: 0.75rem 0.95rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.sheet__bar h4 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.25rem;
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

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

h5 {
  margin: 0 0 0.55rem;
  font-size: 0.95rem;
}

.empty {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.9rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

li {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 0.3rem 0.4rem 0.3rem 0.45rem;
  min-height: 52px;
}

img {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

span {
  font-weight: 700;
  overflow-wrap: anywhere;
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
    margin: calc(-0.55rem - env(safe-area-inset-top, 0px)) -0.85rem 0.85rem;
    padding: calc(0.55rem + env(safe-area-inset-top, 0px)) 0.85rem 0.7rem;
  }

  .split {
    grid-template-columns: 1fr;
  }
}
</style>
