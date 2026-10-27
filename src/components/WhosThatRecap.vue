<script setup>
import { computed } from 'vue'
import {
  durationLabel,
  officialPokemonName,
  playerAnswerLabel,
  winnerLabel,
} from '../services/whosThatPokemon.js'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  hostName: { type: String, default: 'Joueur' },
  guestName: { type: String, default: '' },
  durationSeconds: { type: Number, default: 60 },
  samePokemon: { type: Boolean, default: true },
  host: { type: Object, required: true },
  guest: { type: Object, default: null },
  winner: { type: String, default: 'tie' },
  compact: { type: Boolean, default: false },
})

const hasGuest = computed(() => Boolean(props.guest) && props.guest.pending !== true)
const waitingForOpponent = computed(() => {
  if (!hasGuest.value) return false
  return props.host?.finished === false || props.guest?.finished === false
})
const hostRounds = computed(() => props.host?.rounds || [])
const guestRounds = computed(() => (hasGuest.value ? props.guest?.rounds || [] : []))
const waitingName = computed(() =>
  props.host?.finished === false ? displayHost.value : displayGuest.value,
)
const displayHost = computed(() => props.hostName?.trim() || 'Joueur')
const displayGuest = computed(() => props.guestName?.trim() || 'Adversaire')

const pairedRows = computed(() => {
  const left = hostRounds.value
  const right = guestRounds.value
  const count = Math.max(left.length, right.length)
  return Array.from({ length: count }, (_, index) => {
    const hostRound = left[index] || null
    const guestRound = right[index] || null
    return {
      index,
      id: hostRound?.id || guestRound?.id || 0,
      name: officialPokemonName(hostRound || guestRound),
      host: hostRound,
      guest: guestRound,
    }
  })
})

const outcome = computed(() => {
  if (waitingForOpponent.value) return `En attente de ${waitingName.value}`
  return winnerLabel(
    { winner: props.winner, host: props.host, guest: props.guest },
    displayHost.value,
    displayGuest.value,
  )
})

function sprite(round) {
  if (!round?.id) return ''
  return round.artworkUrl || starterArtworkUrl(round.id)
}

function answerClass(round) {
  if (!round) return 'answer--empty'
  if (round.ok) return 'answer--ok'
  return 'answer--ko'
}

function detailLine(side) {
  if (!side) return '0 bon · 0 faux'
  const bons = side.correct === 1 ? '1 bon' : `${side.correct || 0} bons`
  const faux = side.wrong === 1 ? '1 faux' : `${side.wrong || 0} faux`
  return `${bons} · ${faux}`
}

function pointsWord(side) {
  return (side?.points || 0) === 1 ? 'point' : 'points'
}

function playerClass(side) {
  if (waitingForOpponent.value || !hasGuest.value) return ''
  if (props.winner === 'tie') return 'player--tie'
  if (props.winner === side) return 'player--win'
  return 'player--loss'
}

function playerTag(side) {
  const player = side === 'guest' ? props.guest : props.host
  if (waitingForOpponent.value) return player?.finished ? 'Terminé' : 'En cours'
  if (!hasGuest.value) return ''
  if (props.winner === 'tie') return 'Égalité'
  if (props.winner === side) return 'Gagnant'
  return ''
}
</script>

<template>
  <section
    class="recap"
    :class="{ 'recap--compact': compact }"
    :aria-label="compact ? 'Détail des réponses' : undefined"
    :aria-labelledby="compact ? undefined : 'recap-title'"
  >
    <header class="hero">
      <p class="eyebrow">Partie terminée · {{ durationLabel(durationSeconds) }}</p>
      <h3 :id="compact ? undefined : 'recap-title'">{{ outcome }}</h3>
      <p v-if="waitingForOpponent" class="wait-hint">
        Les scores se mettront à jour quand {{ waitingName }} aura fini.
      </p>

      <div class="duel" :class="{ 'duel--solo': !hasGuest }">
        <article class="player" :class="playerClass('host')">
          <p class="player-tag" :class="{ 'player-tag--ghost': !playerTag('host') }">
            {{ playerTag('host') || '\u00a0' }}
          </p>
          <h4>{{ displayHost }}</h4>
          <p class="player-score">{{ host.points || 0 }}</p>
          <p class="player-unit">{{ pointsWord(host) }}</p>
          <p class="player-meta">{{ detailLine(host) }}</p>
        </article>
        <p v-if="hasGuest" class="duel-vs" aria-hidden="true">VS</p>
        <article v-if="hasGuest" class="player" :class="playerClass('guest')">
          <p class="player-tag" :class="{ 'player-tag--ghost': !playerTag('guest') }">
            {{ playerTag('guest') || '\u00a0' }}
          </p>
          <h4>{{ displayGuest }}</h4>
          <p class="player-score">{{ guest.points || 0 }}</p>
          <p class="player-unit">{{ pointsWord(guest) }}</p>
          <p class="player-meta">{{ detailLine(guest) }}</p>
        </article>
      </div>
    </header>

    <div v-if="hasGuest && samePokemon" class="paired">
      <ul>
        <li v-for="row in pairedRows" :key="`pair-${row.index}`">
          <figure class="sprite-block">
            <img v-if="row.id" :src="sprite(row.host || row.guest)" :alt="row.name" />
            <span v-else class="sprite-gap"></span>
            <figcaption class="poke-name">{{ row.name }}</figcaption>
          </figure>
          <div class="answers">
            <p class="answer" :class="answerClass(row.host)">
              <span class="answer-who">{{ displayHost }}</span>
              {{ playerAnswerLabel(row.host) }}
            </p>
            <p class="answer answer--right" :class="answerClass(row.guest)">
              <span class="answer-who">{{ displayGuest }}</span>
              {{ playerAnswerLabel(row.guest) }}
            </p>
          </div>
        </li>
      </ul>
    </div>

    <div v-else class="split" :class="{ 'split--solo': !hasGuest }">
      <article>
        <h4>{{ displayHost }}</h4>
        <ul>
          <li v-for="(round, index) in hostRounds" :key="`h-${round.id}-${index}`">
            <img :src="sprite(round)" :alt="officialPokemonName(round)" />
            <div class="round-copy">
              <p class="poke-name">{{ officialPokemonName(round) }}</p>
              <p class="answer" :class="answerClass(round)">{{ playerAnswerLabel(round) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!hostRounds.length" class="empty">Aucun Pokémon validé.</p>
      </article>
      <article v-if="hasGuest">
        <h4>{{ displayGuest }}</h4>
        <ul>
          <li v-for="(round, index) in guestRounds" :key="`g-${round.id}-${index}`">
            <img :src="sprite(round)" :alt="officialPokemonName(round)" />
            <div class="round-copy">
              <p class="poke-name">{{ officialPokemonName(round) }}</p>
              <p class="answer" :class="answerClass(round)">{{ playerAnswerLabel(round) }}</p>
            </div>
          </li>
        </ul>
        <p v-if="!guestRounds.length" class="empty">Aucun Pokémon validé.</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.recap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
}

.recap--compact {
  padding: 0.85rem 0.85rem 1rem;
}

.hero {
  display: grid;
  gap: 0.15rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

h3 {
  margin: 0.2rem 0 0;
  font-family: var(--display);
  font-size: clamp(1.45rem, 4.4vw, 2.15rem);
  font-weight: 600;
  line-height: 1.2;
}

.wait-hint,
.empty {
  margin: 0.4rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.duel {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 0.55rem;
  align-items: stretch;
}

.duel--solo {
  grid-template-columns: 1fr;
}

.duel-vs {
  margin: 0;
  align-self: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ink);
  color: var(--cream);
  font-family: var(--display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.player {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.1rem;
  margin: 0;
  min-width: 0;
  padding: 0.85rem 0.55rem 0.95rem;
  border-radius: 18px;
  background: var(--surface-muted);
  border: 1px solid transparent;
}

.player h4 {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-family: var(--display);
  font-size: 1.15rem;
  font-weight: 600;
}

.player-tag {
  margin: 0 0 0.2rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 800;
  background: color-mix(in srgb, var(--taupe) 45%, white);
  color: var(--brown);
}

.player-tag--ghost {
  background: transparent;
  color: transparent;
}

.player-score {
  margin: 0.2rem 0 0;
  font-family: var(--display);
  font-size: clamp(2.2rem, 7vw, 3.1rem);
  font-weight: 600;
  line-height: 1;
  color: var(--ink);
}

.player-unit {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.player-meta {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-soft);
}

.player--win {
  background: color-mix(in srgb, var(--teal) 16%, white);
  border-color: color-mix(in srgb, var(--teal) 50%, var(--taupe));
}

.player--win .player-tag {
  background: var(--teal);
  color: var(--cream);
}

.player--win .player-score {
  color: var(--teal);
}

.player--tie {
  background: color-mix(in srgb, var(--brown) 10%, white);
  border-color: color-mix(in srgb, var(--brown) 35%, var(--taupe));
}

.player--loss .player-score {
  color: var(--ink);
}

.paired,
.split {
  margin-top: 1.1rem;
}

.paired ul,
.split ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.paired li {
  display: grid;
  gap: 0.45rem;
  padding: 0.7rem 0.6rem 0.75rem;
  border-radius: 16px;
  background: var(--surface-muted);
}

.sprite-block {
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  margin: 0;
}

.paired img,
.split img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.poke-name {
  margin: 0;
  color: var(--ink);
  font-family: var(--display);
  font-size: 1.05rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.25;
}

.answers {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.4rem;
  align-items: start;
}

.answer-who {
  display: block;
  margin-bottom: 0.1rem;
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--teal);
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.split--solo {
  grid-template-columns: 1fr;
}

.split h4 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.05rem;
}

.split li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.5rem;
  border-radius: 12px;
  background: var(--surface-muted);
}

.round-copy {
  min-width: 0;
}

.split .poke-name {
  text-align: left;
}

.answer {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
}

.answer--right {
  text-align: right;
}

.answer--ok {
  color: var(--teal);
}

.answer--ko {
  color: #8a3d32;
}

.answer--empty {
  color: var(--text-soft);
}

.sprite-gap {
  width: 64px;
  height: 64px;
}

@media (max-width: 720px) {
  .split:not(.split--solo) {
    grid-template-columns: 1fr;
  }

  .duel-vs {
    width: 32px;
    height: 32px;
    font-size: 0.68rem;
  }
}
</style>
