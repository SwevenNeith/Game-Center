<script setup>
import { computed } from 'vue'

const props = defineProps({
  battle: { type: Object, default: () => ({}) },
  hostName: { type: String, default: 'Hôte' },
  guestName: { type: String, default: 'Invité' },
  running: { type: Boolean, default: false },
  titleId: { type: String, default: 'results-title' },
})

function pct(value) {
  return `${Math.round((Number(value) || 0) * 1000) / 10} %`
}

function verdictLabel(verdict, hostName, guestName) {
  if (verdict === 'host') return `${hostName} l’emporte`
  if (verdict === 'guest') return `${guestName} l’emporte`
  return 'Équilibré / trop serré'
}

const barPct = computed(() => {
  const max = Number(props.battle?.maxBattles) || 300
  const played = Number(props.battle?.played) || 0
  if (props.battle?.progress != null) return Math.min(100, Number(props.battle.progress))
  return Math.min(100, Math.round((played / max) * 100))
})
</script>

<template>
  <section class="results" :aria-labelledby="titleId">
    <h3 :id="titleId">Combat simulé</h3>
    <div v-if="running" class="wait" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p class="hint">
        <template v-if="!battle.played">Préparation des sets et des évolutions…</template>
        <template v-else>
          Simulations en cours… {{ battle.played }}
          <template v-if="battle.maxBattles"> / {{ battle.maxBattles }}</template>
          matchs
        </template>
      </p>
      <div
        class="bar"
        :class="{ 'bar--wait': !battle.played }"
        :aria-valuenow="barPct"
        aria-valuemin="0"
        aria-valuemax="100"
        role="progressbar"
      >
        <span :style="{ width: battle.played ? `${barPct}%` : undefined }"></span>
      </div>
    </div>
    <p v-else-if="battle.error" class="error">{{ battle.error }}</p>
    <template v-else-if="battle.status === 'done' || battle.played">
      <p class="verdict">{{ verdictLabel(battle.verdict, hostName, guestName) }}</p>
      <ul class="facts">
        <li>{{ battle.played }} simulations</li>
        <li>{{ hostName }} : {{ pct(battle.hostWinRate) }}</li>
        <li>{{ guestName }} : {{ pct(battle.guestWinRate) }}</li>
        <li v-if="battle.interval">
          IC 95 % :
          {{ pct(battle.interval.lo) }} – {{ pct(battle.interval.hi) }}
        </li>
        <li>Durée moyenne : {{ battle.avgTurns }} tours</li>
        <li>Nuls : {{ battle.ties }}</li>
      </ul>

      <div class="split">
        <div>
          <h4>{{ hostName }}</h4>
          <p v-if="battle.hostMvp" class="mvp">MVP : {{ battle.hostMvp.name }}</p>
          <ul class="poke-stats">
            <li v-for="row in battle.hostStats" :key="row.species">
              {{ row.name }} · KO {{ row.kos }} · sorties {{ row.sent }} · dégâts {{ Math.round(row.damage) }}
            </li>
          </ul>
        </div>
        <div>
          <h4>{{ guestName }}</h4>
          <p v-if="battle.guestMvp" class="mvp">MVP : {{ battle.guestMvp.name }}</p>
          <ul class="poke-stats">
            <li v-for="row in battle.guestStats" :key="row.species">
              {{ row.name }} · KO {{ row.kos }} · sorties {{ row.sent }} · dégâts {{ Math.round(row.damage) }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="battle.recaps" class="recaps">
        <details v-if="battle.recaps.hostWin">
          <summary>Récap — victoire de {{ hostName }} ({{ battle.recaps.hostWin.turns }} tours)</summary>
          <ol>
            <li v-for="(line, i) in battle.recaps.hostWin.lines" :key="`h-${i}`">{{ line }}</li>
          </ol>
        </details>
        <details v-if="battle.recaps.guestWin">
          <summary>Récap — victoire de {{ guestName }} ({{ battle.recaps.guestWin.turns }} tours)</summary>
          <ol>
            <li v-for="(line, i) in battle.recaps.guestWin.lines" :key="`g-${i}`">{{ line }}</li>
          </ol>
        </details>
        <details v-if="battle.recaps.closest">
          <summary>Récap — combat le plus serré ({{ battle.recaps.closest.turns }} tours)</summary>
          <ol>
            <li v-for="(line, i) in battle.recaps.closest.lines" :key="`c-${i}`">{{ line }}</li>
          </ol>
        </details>
      </div>
    </template>
  </section>
</template>

<style scoped>
.results {
  margin-top: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem;
  box-shadow: var(--shadow);
}

.hint {
  color: var(--text-soft);
}

.wait {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  margin: 0.7rem 0 0.2rem;
}

.wait .hint {
  margin: 0;
  text-align: center;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid color-mix(in srgb, var(--teal) 25%, var(--surface-muted));
  border-top-color: var(--teal);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.bar {
  width: min(100%, 280px);
  height: 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--teal);
  transition: width 0.2s ease;
}

.bar--wait span {
  width: 32%;
  animation: indeterminate 1.1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes indeterminate {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(350%);
  }
}

.error {
  color: #8a3d32;
  font-weight: 600;
}

.verdict {
  font-family: var(--display);
  font-size: 1.25rem;
  margin: 0.4rem 0 0.7rem;
}

.facts,
.poke-stats,
.recaps ol {
  margin: 0;
  padding: 0;
}

.facts {
  list-style: none;
  display: grid;
  gap: 0.25rem;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.poke-stats {
  list-style: none;
  font-size: 0.88rem;
  color: var(--text-soft);
}

.mvp {
  font-weight: 700;
}

.recaps {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.45rem;
}

.recaps ol {
  padding-left: 1.1rem;
  font-size: 0.88rem;
}

@media (max-width: 720px) {
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
