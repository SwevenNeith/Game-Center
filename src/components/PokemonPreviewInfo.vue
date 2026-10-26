<script setup>
import { playingCryUrl, toggleCry } from '../services/cryPlayer.js'
import { STAT_LABELS } from '../services/pokeapi.js'
import { INFO_FIELDS } from '../services/starterAveugle.js'

defineProps({
  pokemon: { type: Object, default: null },
  flags: { type: Object, default: () => ({}) },
})

const EMPTY = '∅'

const labels = Object.fromEntries(
  INFO_FIELDS.map((field) => [field.id, field.id === 'stats' ? 'Statistiques' : field.label]),
)

function typeStyle(type) {
  return { background: type.color, color: '#fff' }
}

function text(value) {
  if (value == null || value === '') return EMPTY
  return value
}
</script>

<template>
  <div v-if="pokemon" class="preview">
    <p v-if="flags.number" class="fact">
      <span class="k">{{ labels.number }}</span>
      <span>{{ pokemon.id ? `#${String(pokemon.id).padStart(4, '0')}` : EMPTY }}</span>
    </p>
    <p v-if="flags.englishName" class="fact">
      <span class="k">{{ labels.englishName }}</span>
      <span>{{ text(pokemon.englishName) }}</span>
    </p>
    <div v-if="flags.cry" class="fact">
      <span class="k">{{ labels.cry }}</span>
      <button v-if="pokemon.cry" type="button" class="cry-btn" @click.stop="toggleCry(pokemon.cry)">
        {{ playingCryUrl === pokemon.cry ? 'Stop' : 'Écouter' }}
      </button>
      <span v-else>{{ EMPTY }}</span>
    </div>
    <p v-if="flags.genus" class="fact">
      <span class="k">{{ labels.genus }}</span>
      <span>{{ text(pokemon.genus) }}</span>
    </p>

    <div v-if="flags.types" class="fact fact--block">
      <span class="k">{{ labels.types }}</span>
      <ul v-if="pokemon.types?.length" class="chips">
        <li v-for="type in pokemon.types" :key="type.slug" class="chip" :style="typeStyle(type)">
          {{ type.name }}
        </li>
      </ul>
      <span v-else>{{ EMPTY }}</span>
    </div>

    <p v-if="flags.evolutionStatus" class="fact">
      <span class="k">{{ labels.evolutionStatus }}</span>
      <span>{{ text(pokemon.evolutionStatus) }}</span>
    </p>
    <p v-if="flags.size" class="fact">
      <span class="k">{{ labels.size }}</span>
      <span>
        {{
          pokemon.heightM != null && pokemon.weightKg != null
            ? `${pokemon.heightM.toFixed(1)} m · ${pokemon.weightKg.toFixed(1)} kg`
            : EMPTY
        }}
      </span>
    </p>

    <div v-if="flags.abilities" class="fact fact--block">
      <span class="k">{{ labels.abilities }}</span>
      <ul v-if="pokemon.abilities?.length" class="stack">
        <li v-for="ability in pokemon.abilities" :key="ability.slug">
          <strong>{{ ability.name }}</strong>
          <span v-if="ability.hidden"> (caché)</span>
          <span v-if="ability.effect" class="muted"> — {{ ability.effect }}</span>
        </li>
      </ul>
      <span v-else>{{ EMPTY }}</span>
    </div>

    <div v-if="flags.stats" class="fact fact--block">
      <span class="k">{{ labels.stats }}</span>
      <ul v-if="pokemon.stats?.length" class="stats">
        <li v-for="stat in pokemon.stats" :key="stat.name">
          <span>{{ STAT_LABELS[stat.name] || stat.name }}</span>
          <strong>{{ stat.value }}</strong>
        </li>
      </ul>
      <span v-else>{{ EMPTY }}</span>
    </div>

    <p v-if="flags.generation" class="fact">
      <span class="k">{{ labels.generation }}</span>
      <span>{{ text(pokemon.generation) }}</span>
    </p>
    <p v-if="flags.habitat" class="fact">
      <span class="k">{{ labels.habitat }}</span>
      <span>{{ text(pokemon.habitat) }}</span>
    </p>
    <p v-if="flags.color" class="fact">
      <span class="k">{{ labels.color }}</span>
      <span>{{ text(pokemon.color) }}</span>
    </p>
    <p v-if="flags.eggGroups" class="fact">
      <span class="k">{{ labels.eggGroups }}</span>
      <span>{{ pokemon.eggGroups?.length ? pokemon.eggGroups.join(', ') : EMPTY }}</span>
    </p>

    <div v-if="flags.flavors" class="fact fact--block fact--flavors">
      <span class="k">{{ labels.flavors }}</span>
      <ul v-if="pokemon.flavors?.length" class="stack flavors">
        <li v-for="(entry, index) in pokemon.flavors" :key="index">
          <p class="muted">{{ entry.text }}</p>
          <p v-if="entry.versions?.length" class="versions">{{ entry.versions.join(' · ') }}</p>
        </li>
      </ul>
      <span v-else>{{ EMPTY }}</span>
    </div>

    <div v-if="flags.moves" class="fact fact--block">
      <span class="k">{{ labels.moves }}</span>
      <ul v-if="pokemon.moves?.length" class="stack">
        <li v-for="(move, index) in pokemon.moves.slice(0, 8)" :key="`${move.name}-${index}`">
          N.{{ move.level }} {{ move.name }}
        </li>
      </ul>
      <span v-else>{{ EMPTY }}</span>
    </div>
  </div>
</template>

<style scoped>
.preview {
  margin-top: 0.55rem;
  text-align: left;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
  display: grid;
  gap: 0.28rem;
}

.fact {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(5.4rem, 38%) 1fr;
  gap: 0.35rem;
  align-items: start;
}

.fact--block {
  align-items: start;
}

.k {
  color: var(--text-soft);
  font-weight: 700;
}

.k::after {
  content: ' :';
}

.muted {
  margin: 0;
  color: var(--text-soft);
}

.chips,
.stack,
.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.stack,
.stats {
  flex-direction: column;
}

.chip {
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}

.stats li {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
}

.cry-btn {
  justify-self: start;
  min-height: 36px;
  padding: 0.2rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--teal) 16%, var(--surface));
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
}

.fact--flavors {
  grid-template-columns: 1fr;
}

.flavors {
  max-height: 14rem;
  overflow: auto;
  padding-right: 0.2rem;
}

.flavors p {
  margin: 0;
}

.versions {
  margin: 0.12rem 0 0;
  font-size: 0.68rem;
  color: var(--text-soft);
}
</style>
