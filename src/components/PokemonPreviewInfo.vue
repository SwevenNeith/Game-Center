<script setup>
import { STAT_LABELS } from '../services/pokeapi.js'
import { INFO_FIELDS } from '../services/starterAveugle.js'

defineProps({
  pokemon: { type: Object, default: null },
  flags: { type: Object, default: () => ({}) },
})

const labels = Object.fromEntries(
  INFO_FIELDS.map((field) => [
    field.id,
    field.id === 'rarity' ? 'Rareté' : field.id === 'stats' ? 'Statistiques' : field.id === 'weaknesses' ? 'Faiblesses' : field.label,
  ]),
)

function typeStyle(type) {
  return { background: type.color, color: '#fff' }
}

function rarityText(pokemon) {
  const bits = []
  if (pokemon.isBaby) bits.push('Bébé')
  if (pokemon.isLegendary) bits.push('Légendaire')
  if (pokemon.isMythical) bits.push('Mythique')
  return bits.length ? bits.join(', ') : 'Standard'
}
</script>

<template>
  <div v-if="pokemon" class="preview">
    <p v-if="flags.number" class="fact">
      <span class="k">{{ labels.number }}</span>
      <span>#{{ String(pokemon.id).padStart(4, '0') }}</span>
    </p>
    <p v-if="flags.englishName" class="fact">
      <span class="k">{{ labels.englishName }}</span>
      <span>{{ pokemon.englishName }}</span>
    </p>
    <p v-if="flags.genus && pokemon.genus" class="fact">
      <span class="k">{{ labels.genus }}</span>
      <span>{{ pokemon.genus }}</span>
    </p>

    <div v-if="flags.types" class="fact fact--block">
      <span class="k">{{ labels.types }}</span>
      <ul class="chips">
        <li v-for="type in pokemon.types" :key="type.slug" class="chip" :style="typeStyle(type)">
          {{ type.name }}
        </li>
      </ul>
    </div>

    <p v-if="flags.evolutionStatus" class="fact">
      <span class="k">{{ labels.evolutionStatus }}</span>
      <span>{{ pokemon.evolutionStatus }}</span>
    </p>
    <p v-if="flags.rarity" class="fact">
      <span class="k">{{ labels.rarity }}</span>
      <span>{{ rarityText(pokemon) }}</span>
    </p>
    <p v-if="flags.size" class="fact">
      <span class="k">{{ labels.size }}</span>
      <span>{{ pokemon.heightM.toFixed(1) }} m · {{ pokemon.weightKg.toFixed(1) }} kg</span>
    </p>
    <p v-if="flags.baseExperience && pokemon.baseExperience" class="fact">
      <span class="k">{{ labels.baseExperience }}</span>
      <span>{{ pokemon.baseExperience }}</span>
    </p>

    <div v-if="flags.abilities && pokemon.abilities.length" class="fact fact--block">
      <span class="k">{{ labels.abilities }}</span>
      <ul class="stack">
        <li v-for="ability in pokemon.abilities" :key="ability.slug">
          <strong>{{ ability.name }}</strong>
          <span v-if="ability.hidden"> (caché)</span>
          <span v-if="ability.effect" class="muted"> — {{ ability.effect }}</span>
        </li>
      </ul>
    </div>

    <div v-if="flags.stats" class="fact fact--block">
      <span class="k">{{ labels.stats }}</span>
      <ul class="stats">
        <li v-for="stat in pokemon.stats" :key="stat.name">
          <span>{{ STAT_LABELS[stat.name] || stat.name }}</span>
          <strong>{{ stat.value }}</strong>
        </li>
      </ul>
    </div>

    <div v-if="flags.weaknesses" class="fact fact--block">
      <span class="k">{{ labels.weaknesses }}</span>
      <div class="matchups">
        <p v-if="pokemon.weaknesses.x4.length">×4 : {{ pokemon.weaknesses.x4.map((t) => t.name).join(', ') }}</p>
        <p v-if="pokemon.weaknesses.x2.length">×2 : {{ pokemon.weaknesses.x2.map((t) => t.name).join(', ') }}</p>
        <p v-if="pokemon.weaknesses.x05.length">×½ : {{ pokemon.weaknesses.x05.map((t) => t.name).join(', ') }}</p>
        <p v-if="pokemon.weaknesses.x025?.length">×¼ : {{ pokemon.weaknesses.x025.map((t) => t.name).join(', ') }}</p>
        <p v-if="pokemon.weaknesses.x0.length">Immunisé : {{ pokemon.weaknesses.x0.map((t) => t.name).join(', ') }}</p>
      </div>
    </div>

    <p v-if="flags.generation && pokemon.generation" class="fact">
      <span class="k">{{ labels.generation }}</span>
      <span>{{ pokemon.generation }}</span>
    </p>
    <p v-if="flags.habitat && pokemon.habitat" class="fact">
      <span class="k">{{ labels.habitat }}</span>
      <span>{{ pokemon.habitat }}</span>
    </p>
    <p v-if="flags.color && pokemon.color" class="fact">
      <span class="k">{{ labels.color }}</span>
      <span>{{ pokemon.color }}</span>
    </p>
    <p v-if="flags.growthRate && pokemon.growthRate" class="fact">
      <span class="k">{{ labels.growthRate }}</span>
      <span>{{ pokemon.growthRate }}</span>
    </p>
    <p v-if="flags.eggGroups && pokemon.eggGroups.length" class="fact">
      <span class="k">{{ labels.eggGroups }}</span>
      <span>{{ pokemon.eggGroups.join(', ') }}</span>
    </p>
    <p v-if="flags.gender" class="fact">
      <span class="k">{{ labels.gender }}</span>
      <span>{{ pokemon.gender }}</span>
    </p>
    <p v-if="flags.captureRate && pokemon.captureRate != null" class="fact">
      <span class="k">{{ labels.captureRate }}</span>
      <span>{{ pokemon.captureRate }}</span>
    </p>
    <p v-if="flags.baseHappiness && pokemon.baseHappiness != null" class="fact">
      <span class="k">{{ labels.baseHappiness }}</span>
      <span>{{ pokemon.baseHappiness }}</span>
    </p>
    <p v-if="flags.hatchSteps && pokemon.hatchSteps != null" class="fact">
      <span class="k">{{ labels.hatchSteps }}</span>
      <span>{{ pokemon.hatchSteps }} pas</span>
    </p>
    <p v-if="flags.heldItems && pokemon.heldItems.length" class="fact">
      <span class="k">{{ labels.heldItems }}</span>
      <span>{{ pokemon.heldItems.join(', ') }}</span>
    </p>

    <div v-if="flags.flavors && pokemon.flavors.length" class="fact fact--block">
      <span class="k">{{ labels.flavors }}</span>
      <ul class="stack">
        <li v-for="(entry, index) in pokemon.flavors.slice(0, 3)" :key="index" class="muted">
          {{ entry.text }}
        </li>
      </ul>
    </div>

    <div v-if="flags.moves && pokemon.moves.length" class="fact fact--block">
      <span class="k">{{ labels.moves }}</span>
      <ul class="stack">
        <li v-for="(move, index) in pokemon.moves.slice(0, 8)" :key="`${move.name}-${index}`">
          N.{{ move.level }} {{ move.name }}
        </li>
      </ul>
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

.muted,
.matchups p {
  margin: 0;
  color: var(--text-soft);
}

.matchups {
  display: grid;
  gap: 0.12rem;
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
</style>
