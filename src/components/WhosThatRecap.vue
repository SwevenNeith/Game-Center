<script setup>
import { computed } from 'vue'
import { durationLabel } from '../services/whosThatPokemon.js'
import { starterArtworkUrl } from '../services/pokeapi.js'

const props = defineProps({
  hostName: { type: String, default: 'Joueur' },
  guestName: { type: String, default: '' },
  durationSeconds: { type: Number, default: 60 },
  samePokemon: { type: Boolean, default: true },
  host: { type: Object, required: true },
  guest: { type: Object, default: null },
  winner: { type: String, default: 'solo' },
  compact: { type: Boolean, default: false },
})

const guestPending = computed(() => !props.guest || props.guest.pending)
const hostRounds = computed(() => props.host?.rounds || [])
const guestRounds = computed(() => (guestPending.value ? [] : props.guest?.rounds || []))

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
      host: hostRound,
      guest: guestRound,
    }
  })
})

function sprite(round) {
  if (!round?.id) return ''
  return round.artworkUrl || starterArtworkUrl(round.id)
}

function answerLabel(round) {
  if (!round) return '—'
  if (round.skipped) return 'Passé'
  if (round.guess) return round.guess
  return round.name || '—'
}

function answerClass(round) {
  if (!round) return 'answer--empty'
  if (round.ok) return 'answer--ok'
  return 'answer--ko'
}

function statsLine(side) {
  if (!side) return '0 pt · 0 bon · 0 faux'
  const pts = side.points === 1 ? '1 pt' : `${side.points || 0} pts`
  const bons = side.correct === 1 ? '1 bon' : `${side.correct || 0} bons`
  const faux = `${side.wrong || 0} faux`
  return `${pts} · ${bons} · ${faux}`
}

const outcome = computed(() => {
  if (props.winner === 'solo' || guestPending.value) return 'Partie solo'
  if (props.winner === 'host') return `${props.hostName} a gagné`
  if (props.winner === 'guest') return `${props.guestName} a gagné`
  return 'Égalité'
})
</script>

<template>
  <section class="recap" :class="{ 'recap--compact': compact }" :aria-label="compact ? 'Détail des réponses' : undefined" :aria-labelledby="compact ? undefined : 'recap-title'">
    <template v-if="!compact">
      <p class="eyebrow">Partie terminée</p>
      <h3 id="recap-title">{{ durationLabel(durationSeconds) }}</h3>
      <p class="outcome">{{ outcome }}</p>
      <p class="score-line">{{ host.points || 0 }} {{ (host.points || 0) === 1 ? 'point' : 'points' }}</p>
      <p class="card-desc">{{ statsLine(host) }}</p>
      <p v-if="!guestPending" class="card-desc">
        {{ guestName }} · {{ statsLine(guest) }}
      </p>
    </template>

    <div v-if="!guestPending && samePokemon" class="paired">
      <div class="paired-head">
        <span>{{ hostName }}</span>
        <span>{{ guestName }}</span>
      </div>
      <ul>
        <li v-for="row in pairedRows" :key="`pair-${row.index}`">
          <p class="answer" :class="answerClass(row.host)">{{ answerLabel(row.host) }}</p>
          <img v-if="row.id" :src="sprite(row.host || row.guest)" alt="" />
          <span v-else class="sprite-gap"></span>
          <p class="answer answer--right" :class="answerClass(row.guest)">{{ answerLabel(row.guest) }}</p>
        </li>
      </ul>
    </div>

    <div v-else class="split" :class="{ 'split--solo': guestPending }">
      <article>
        <h4>{{ hostName }}</h4>
        <ul>
          <li v-for="(round, index) in hostRounds" :key="`h-${round.id}-${index}`">
            <img :src="sprite(round)" alt="" />
            <p class="answer" :class="answerClass(round)">{{ answerLabel(round) }}</p>
          </li>
        </ul>
        <p v-if="!hostRounds.length" class="empty">Aucun Pokémon validé.</p>
      </article>
      <article v-if="!guestPending">
        <h4>{{ guestName }}</h4>
        <ul>
          <li v-for="(round, index) in guestRounds" :key="`g-${round.id}-${index}`">
            <img :src="sprite(round)" alt="" />
            <p class="answer" :class="answerClass(round)">{{ answerLabel(round) }}</p>
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

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--teal);
}

h3 {
  margin: 0.15rem 0 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.outcome {
  margin: 0.35rem 0 0;
  font-weight: 800;
}

.score-line {
  margin: 0.35rem 0 0;
  font-family: var(--display);
  font-size: clamp(2rem, 5vw, 2.6rem);
  font-weight: 600;
}

.card-desc,
.empty {
  margin: 0.35rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.paired,
.split {
  margin-top: 1rem;
}

.paired-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--teal);
}

.paired-head span:last-child {
  text-align: right;
  grid-column: 3;
}

.paired ul,
.split ul {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.paired li {
  display: grid;
  grid-template-columns: 1fr 48px 1fr;
  gap: 0.4rem;
  align-items: center;
  padding: 0.35rem 0.4rem;
  border-radius: 12px;
  background: var(--surface-muted);
}

.paired img,
.split img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  justify-self: center;
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
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  border-radius: 12px;
  background: var(--surface-muted);
}

.answer {
  margin: 0;
  font-weight: 700;
  font-size: 0.9rem;
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
  width: 48px;
  height: 48px;
}

@media (max-width: 720px) {
  .split:not(.split--solo) {
    grid-template-columns: 1fr;
  }
}
</style>
