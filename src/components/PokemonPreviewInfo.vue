<script setup>
import { STAT_LABELS } from '../services/pokeapi.js'

defineProps({
  pokemon: { type: Object, default: null },
  flags: { type: Object, default: () => ({}) },
})

function typeStyle(type) {
  return { background: type.color, color: '#fff' }
}
</script>

<template>
  <div v-if="pokemon" class="preview">
    <p v-if="flags.number" class="num">#{{ String(pokemon.id).padStart(4, '0') }}</p>
    <p v-if="flags.englishName" class="line">{{ pokemon.englishName }}</p>
    <p v-if="flags.genus && pokemon.genus" class="line muted">{{ pokemon.genus }}</p>

    <ul v-if="flags.types" class="chips">
      <li v-for="type in pokemon.types" :key="type.slug" class="chip" :style="typeStyle(type)">
        {{ type.name }}
      </li>
    </ul>

    <p v-if="flags.evolutionStatus" class="line">{{ pokemon.evolutionStatus }}</p>
    <p v-if="flags.rarity" class="line muted">
      <template v-if="pokemon.isBaby">Bébé</template>
      <template v-if="pokemon.isLegendary"> Légendaire</template>
      <template v-if="pokemon.isMythical"> Mythique</template>
      <template v-if="!pokemon.isBaby && !pokemon.isLegendary && !pokemon.isMythical">Standard</template>
    </p>
    <p v-if="flags.size" class="line">
      {{ pokemon.heightM.toFixed(1) }} m · {{ pokemon.weightKg.toFixed(1) }} kg
    </p>
    <p v-if="flags.baseExperience && pokemon.baseExperience" class="line">
      {{ pokemon.baseExperience }} exp. de base
    </p>

    <ul v-if="flags.abilities && pokemon.abilities.length" class="stack">
      <li v-for="ability in pokemon.abilities" :key="ability.slug">
        <strong>{{ ability.name }}</strong>
        <span v-if="ability.hidden"> (caché)</span>
        <span v-if="ability.effect" class="muted"> — {{ ability.effect }}</span>
      </li>
    </ul>

    <ul v-if="flags.stats" class="stats">
      <li v-for="stat in pokemon.stats" :key="stat.name">
        <span>{{ STAT_LABELS[stat.name] || stat.name }}</span>
        <strong>{{ stat.value }}</strong>
      </li>
    </ul>

    <div v-if="flags.weaknesses" class="matchups">
      <p v-if="pokemon.weaknesses.x4.length">×4 : {{ pokemon.weaknesses.x4.map((t) => t.name).join(', ') }}</p>
      <p v-if="pokemon.weaknesses.x2.length">×2 : {{ pokemon.weaknesses.x2.map((t) => t.name).join(', ') }}</p>
      <p v-if="pokemon.weaknesses.x05.length">×½ : {{ pokemon.weaknesses.x05.map((t) => t.name).join(', ') }}</p>
      <p v-if="pokemon.weaknesses.x025?.length">×¼ : {{ pokemon.weaknesses.x025.map((t) => t.name).join(', ') }}</p>
      <p v-if="pokemon.weaknesses.x0.length">Immunisé : {{ pokemon.weaknesses.x0.map((t) => t.name).join(', ') }}</p>
    </div>

    <p v-if="flags.generation && pokemon.generation" class="line">{{ pokemon.generation }}</p>
    <p v-if="flags.habitat && pokemon.habitat" class="line">Habitat : {{ pokemon.habitat }}</p>
    <p v-if="flags.color && pokemon.color" class="line">Couleur : {{ pokemon.color }}</p>
    <p v-if="flags.growthRate && pokemon.growthRate" class="line">Croissance : {{ pokemon.growthRate }}</p>
    <p v-if="flags.eggGroups && pokemon.eggGroups.length" class="line">
      Œufs : {{ pokemon.eggGroups.join(', ') }}
    </p>
    <p v-if="flags.gender" class="line">{{ pokemon.gender }}</p>
    <p v-if="flags.captureRate && pokemon.captureRate != null" class="line">
      Capture : {{ pokemon.captureRate }}
    </p>
    <p v-if="flags.baseHappiness && pokemon.baseHappiness != null" class="line">
      Bonheur : {{ pokemon.baseHappiness }}
    </p>
    <p v-if="flags.hatchSteps && pokemon.hatchSteps != null" class="line">
      Éclosion : {{ pokemon.hatchSteps }} pas
    </p>
    <p v-if="flags.heldItems && pokemon.heldItems.length" class="line">
      Objets : {{ pokemon.heldItems.join(', ') }}
    </p>

    <ul v-if="flags.flavors && pokemon.flavors.length" class="stack">
      <li v-for="(entry, index) in pokemon.flavors.slice(0, 3)" :key="index" class="muted">
        {{ entry.text }}
      </li>
    </ul>

    <ul v-if="flags.moves && pokemon.moves.length" class="stack">
      <li v-for="(move, index) in pokemon.moves.slice(0, 8)" :key="`${move.name}-${index}`">
        N.{{ move.level }} {{ move.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.preview {
  margin-top: 0.55rem;
  text-align: left;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.num {
  margin: 0;
  font-weight: 700;
  color: var(--teal);
}

.line,
.muted,
.matchups p {
  margin: 0.2rem 0 0;
}

.muted,
.matchups p {
  color: var(--text-soft);
}

.chips,
.stack,
.stats {
  list-style: none;
  margin: 0.35rem 0 0;
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
