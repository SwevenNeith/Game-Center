<script setup>
import { STAT_LABELS } from '../services/pokeapi.js'

defineProps({
  title: { type: String, default: '' },
  sets: { type: Array, default: () => [] },
  canRegen: { type: Boolean, default: false },
  regenerating: { type: Number, default: -1 },
})

const emit = defineEmits(['regen'])

function statEntries(stats) {
  return [
    ['hp', stats?.hp],
    ['attack', stats?.atk],
    ['defense', stats?.def],
    ['special-attack', stats?.spa],
    ['special-defense', stats?.spd],
    ['speed', stats?.spe],
  ]
}

function typeStyle(type) {
  return { background: type.color || type, color: '#fff' }
}

const NATURE_FR = {
  adamant: 'Rigide',
  modest: 'Modeste',
  jolly: 'Jovial',
  timid: 'Timide',
  serious: 'Sérieux',
}

function natureFr(nature) {
  return NATURE_FR[String(nature || '').toLowerCase()] || nature
}
</script>

<template>
  <section class="recap">
    <h3>{{ title }}</h3>
    <ul class="set-list">
      <li v-for="(set, index) in sets" :key="set.pokemonId || index">
        <details class="set-card">
          <summary class="set-head">
            <img :src="set.artwork || set.sprite" :alt="set.name" />
            <div class="set-title">
              <strong>{{ set.name }}</strong>
              <p class="muted">N.{{ set.level }} · {{ natureFr(set.nature) }}</p>
            </div>
            <button
              v-if="canRegen"
              type="button"
              class="regen"
              :disabled="regenerating >= 0"
              @click.prevent.stop="emit('regen', index)"
            >
              {{ regenerating === index ? 'Tirage…' : 'Regénérer' }}
            </button>
          </summary>

          <div class="set-body">
            <ul class="chips">
              <li v-for="type in set.types" :key="type.slug" class="chip" :style="typeStyle(type)">
                {{ type.name }}
              </li>
            </ul>
            <p class="line"><strong>Talent</strong> {{ set.ability?.name }}</p>
            <p class="line item-line">
              <img v-if="set.item?.sprite" :src="set.item.sprite" alt="" />
              <strong>Objet</strong> {{ set.item?.name }}
            </p>
            <ul class="moves">
              <li v-for="move in (set.moves || []).slice(0, 4)" :key="move.slug">
                <span class="chip" :style="{ background: move.color || '#888', color: '#fff' }">{{ move.typeName }}</span>
                <strong>{{ move.name }}</strong>
                <em>{{ move.className }}</em>
              </li>
            </ul>
            <ul class="stats">
              <li v-for="[key, value] in statEntries(set.stats)" :key="key">
                <span>{{ STAT_LABELS[key] || key }}</span>
                <strong>{{ value }}</strong>
              </li>
            </ul>
          </div>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.recap {
  display: grid;
  gap: 0.7rem;
}

.set-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.set-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 0.35rem 0.7rem 0.45rem;
  box-shadow: var(--shadow);
}

.set-head {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 0.55rem;
  align-items: center;
  cursor: pointer;
  list-style: none;
  min-height: 56px;
}

.set-head::-webkit-details-marker {
  display: none;
}

.set-head img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.set-title strong {
  font-size: 1rem;
}

.muted {
  margin: 0.1rem 0 0;
  color: var(--text-soft);
  font-size: 0.82rem;
}

.set-body {
  padding: 0.15rem 0 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  margin-top: 0.2rem;
}

.chips,
.moves,
.stats {
  list-style: none;
  margin: 0;
  padding: 0;
}

.chips {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin: 0.55rem 0 0.2rem;
}

.chip {
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.line {
  margin: 0.3rem 0 0;
  font-size: 0.9rem;
}

.item-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.item-line img {
  width: 24px;
  height: 24px;
}

.moves {
  margin-top: 0.55rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.moves li {
  display: grid;
  gap: 0.12rem;
  min-height: 64px;
  padding: 0.45rem 0.5rem;
  border-radius: 12px;
  background: var(--surface-muted);
  align-content: center;
}

.moves strong {
  font-size: 0.88rem;
  line-height: 1.15;
}

.moves em {
  color: var(--text-soft);
  font-style: normal;
  font-size: 0.72rem;
}

.stats {
  margin-top: 0.55rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.2rem 0.8rem;
  font-size: 0.85rem;
}

.stats li {
  display: flex;
  justify-content: space-between;
}

.regen {
  border: none;
  border-radius: 10px;
  min-height: 36px;
  padding: 0 0.65rem;
  background: var(--surface-muted);
  font-weight: 700;
}

@media (max-width: 720px) {
  .set-head {
    grid-template-columns: 44px 1fr;
  }

  .regen {
    grid-column: 1 / -1;
  }
}
</style>
