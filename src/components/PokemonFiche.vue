<script setup>
import { STAT_LABELS } from '../services/pokeapi.js'

defineProps({
  pokemon: { type: Object, required: true },
})

function typeStyle(type) {
  return { background: type.color, color: '#fff' }
}
</script>

<template>
  <article class="fiche">
    <div class="fiche__hero">
      <div class="arts">
        <figure v-if="pokemon.artwork">
          <img :src="pokemon.artwork" :alt="pokemon.name" />
          <figcaption>Normal</figcaption>
        </figure>
        <figure v-if="pokemon.shinyArtwork">
          <img :src="pokemon.shinyArtwork" :alt="`${pokemon.name} chromatique`" />
          <figcaption>Chromatique</figcaption>
        </figure>
      </div>

      <div class="identity">
        <p class="num">#{{ String(pokemon.id).padStart(4, '0') }}</p>
        <h4>{{ pokemon.name }}</h4>
        <p class="english">{{ pokemon.englishName }}</p>
        <p v-if="pokemon.genus" class="genus">{{ pokemon.genus }}</p>

        <ul class="chips">
          <li v-for="type in pokemon.types" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">
            {{ type.name }}
          </li>
          <li class="chip">{{ pokemon.evolutionStatus }}</li>
          <li v-if="pokemon.isBaby" class="chip">Bébé</li>
          <li v-if="pokemon.isLegendary" class="chip">Légendaire</li>
          <li v-if="pokemon.isMythical" class="chip">Mythique</li>
        </ul>

        <p class="measures">
          {{ pokemon.heightM.toFixed(1) }} m · {{ pokemon.weightKg.toFixed(1) }} kg
          <span v-if="pokemon.baseExperience"> · {{ pokemon.baseExperience }} exp. de base</span>
        </p>

        <audio v-if="pokemon.cry" class="cry" controls preload="none" :src="pokemon.cry">
          Cri de {{ pokemon.name }}
        </audio>
      </div>
    </div>

    <section v-if="pokemon.abilities.length" class="block">
      <h5>Talents</h5>
      <ul class="abilities">
        <li v-for="ability in pokemon.abilities" :key="ability.slug">
          <p>
            <strong>{{ ability.name }}</strong>
            <span v-if="ability.hidden" class="tag">Caché</span>
          </p>
          <p v-if="ability.effect" class="muted">{{ ability.effect }}</p>
        </li>
      </ul>
    </section>

    <section class="block">
      <h5>Statistiques de base <span class="muted">(total {{ pokemon.statTotal }})</span></h5>
      <ul class="stats">
        <li v-for="stat in pokemon.stats" :key="stat.name">
          <span>{{ STAT_LABELS[stat.name] || stat.name }}</span>
          <div class="bar">
            <i :style="{ width: `${Math.min(100, (stat.value / 180) * 100)}%` }"></i>
          </div>
          <strong>{{ stat.value }}</strong>
        </li>
      </ul>
    </section>

    <section class="block">
      <h5>Faiblesses et résistances</h5>
      <dl class="matchups">
        <div v-if="pokemon.weaknesses.x4.length">
          <dt>×4</dt>
          <dd>
            <span v-for="type in pokemon.weaknesses.x4" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">{{ type.name }}</span>
          </dd>
        </div>
        <div v-if="pokemon.weaknesses.x2.length">
          <dt>×2</dt>
          <dd>
            <span v-for="type in pokemon.weaknesses.x2" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">{{ type.name }}</span>
          </dd>
        </div>
        <div v-if="pokemon.weaknesses.x05.length">
          <dt>×½</dt>
          <dd>
            <span v-for="type in pokemon.weaknesses.x05" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">{{ type.name }}</span>
          </dd>
        </div>
        <div v-if="pokemon.weaknesses.x025.length">
          <dt>×¼</dt>
          <dd>
            <span v-for="type in pokemon.weaknesses.x025" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">{{ type.name }}</span>
          </dd>
        </div>
        <div v-if="pokemon.weaknesses.x0.length">
          <dt>Immunisé</dt>
          <dd>
            <span v-for="type in pokemon.weaknesses.x0" :key="type.slug" class="chip chip--type" :style="typeStyle(type)">{{ type.name }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="block">
      <h5>Évolution</h5>
      <p v-if="pokemon.evolvesFrom" class="muted">Évolue depuis {{ pokemon.evolvesFrom }}.</p>
      <ol v-if="pokemon.evolution.length" class="evo">
        <li v-for="node in pokemon.evolution" :key="node.slug" :class="{ 'evo--current': node.isCurrent }">
          <strong>#{{ String(node.id).padStart(4, '0') }} {{ node.name }}</strong>
          <p v-if="node.how.length" class="muted">{{ node.how.join(' / ') }}</p>
        </li>
      </ol>
    </section>

    <section class="block facts">
      <h5>Données d’espèce</h5>
      <dl>
        <div v-if="pokemon.generation"><dt>Génération</dt><dd>{{ pokemon.generation }}</dd></div>
        <div v-if="pokemon.habitat"><dt>Habitat</dt><dd>{{ pokemon.habitat }}</dd></div>
        <div v-if="pokemon.color"><dt>Couleur</dt><dd>{{ pokemon.color }}</dd></div>
        <div v-if="pokemon.growthRate"><dt>Croissance</dt><dd>{{ pokemon.growthRate }}</dd></div>
        <div v-if="pokemon.eggGroups.length"><dt>Groupes d’œuf</dt><dd>{{ pokemon.eggGroups.join(', ') }}</dd></div>
        <div><dt>Sexe</dt><dd>{{ pokemon.gender }}</dd></div>
        <div v-if="pokemon.captureRate != null"><dt>Taux de capture</dt><dd>{{ pokemon.captureRate }}</dd></div>
        <div v-if="pokemon.baseHappiness != null"><dt>Bonheur de base</dt><dd>{{ pokemon.baseHappiness }}</dd></div>
        <div v-if="pokemon.hatchSteps != null"><dt>Éclosion</dt><dd>{{ pokemon.hatchSteps }} pas</dd></div>
        <div v-if="pokemon.heldItems.length"><dt>Objets tenus</dt><dd>{{ pokemon.heldItems.join(', ') }}</dd></div>
      </dl>
    </section>

    <section v-if="pokemon.flavors.length" class="block">
      <h5>Descriptions du Pokédex</h5>
      <ul class="flavors">
        <li v-for="(entry, index) in pokemon.flavors" :key="index">
          <p>{{ entry.text }}</p>
          <p class="muted">{{ entry.versions.join(' · ') }}</p>
        </li>
      </ul>
    </section>

    <section v-if="pokemon.moves.length" class="block">
      <h5>Capacités apprises par niveau</h5>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Capacité</th>
              <th>Type</th>
              <th>Cat.</th>
              <th>Puis.</th>
              <th>Préc.</th>
              <th>PP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(move, index) in pokemon.moves" :key="`${move.name}-${index}`">
              <td>{{ move.level }}</td>
              <td>{{ move.name }}</td>
              <td>
                <span v-if="move.type" class="chip chip--type chip--tiny" :style="typeStyle(move.type)">{{ move.type.name }}</span>
              </td>
              <td>{{ move.className }}</td>
              <td>{{ move.power }}</td>
              <td>{{ move.accuracy }}</td>
              <td>{{ move.pp }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </article>
</template>

<style scoped>
.fiche {
  margin-top: 1.1rem;
  display: grid;
  gap: 1.15rem;
}

.fiche__hero {
  display: grid;
  grid-template-columns: minmax(180px, 280px) 1fr;
  gap: 1rem;
  align-items: start;
}

.arts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.arts figure {
  margin: 0;
  background: var(--surface-muted);
  border-radius: 18px;
  padding: 0.65rem;
  text-align: center;
}

.arts img {
  margin: 0 auto;
  max-height: 160px;
}

.arts figcaption,
.muted,
.english,
.genus,
.measures {
  color: var(--text-soft);
}

.arts figcaption {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.num {
  margin: 0;
  font-weight: 700;
  color: var(--teal);
}

h4 {
  margin: 0.1rem 0 0;
  font-family: var(--display);
  font-size: 1.7rem;
}

.english,
.genus,
.measures {
  margin: 0.15rem 0 0;
}

.english {
  text-transform: none;
}

.chips,
.matchups dd {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chips {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
}

.chip {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--teal) 14%, white);
  color: var(--teal);
  font-size: 0.78rem;
  font-weight: 700;
}

.chip--type {
  text-transform: capitalize;
}

.chip--tiny {
  font-size: 0.7rem;
}

.cry {
  display: block;
  width: min(100%, 280px);
  margin-top: 0.8rem;
  height: 36px;
}

.block h5 {
  margin: 0 0 0.55rem;
  font-family: var(--display);
  font-size: 1.15rem;
}

.abilities,
.flavors,
.evo,
.stats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.abilities li,
.flavors li,
.evo li {
  background: var(--surface-muted);
  border-radius: 14px;
  padding: 0.7rem 0.8rem;
}

.abilities p,
.flavors p,
.evo p {
  margin: 0;
}

.tag {
  margin-left: 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--brown);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats li {
  display: grid;
  grid-template-columns: 6.2rem 1fr 2.2rem;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
}

.bar {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--taupe) 45%, white);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--teal);
}

.matchups {
  margin: 0;
  display: grid;
  gap: 0.45rem;
}

.matchups > div {
  display: grid;
  grid-template-columns: 5.2rem 1fr;
  gap: 0.5rem;
  align-items: center;
}

.matchups dt {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--brown);
}

.matchups dd {
  margin: 0;
}

.evo--current {
  outline: 2px solid color-mix(in srgb, var(--teal) 55%, white);
}

.facts dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.55rem 0.8rem;
}

.facts div {
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 0.55rem 0.7rem;
}

.facts dt {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--brown);
}

.facts dd {
  margin: 0.15rem 0 0;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

th,
td {
  padding: 0.45rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--brown);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

@media (max-width: 720px) {
  .fiche__hero,
  .arts {
    grid-template-columns: 1fr;
  }
}
</style>
