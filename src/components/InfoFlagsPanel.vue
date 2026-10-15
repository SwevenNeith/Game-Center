<script setup>
import { INFO_FIELDS } from '../services/starterAveugle.js'

defineProps({
  flags: { type: Object, default: () => ({}) },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <section class="flags" aria-labelledby="flags-title">
    <h3 id="flags-title">Informations visibles</h3>
    <p class="flags-desc">
      {{
        editable
          ? 'Coche ce que tes Pokémon afficheront (hors nom français, images et chaîne d’évolution). L’invité voit tes choix en direct.'
          : 'L’hôte choisit les infos affichées sous les propositions. Tu vois ses choix en direct.'
      }}
    </p>
    <ul>
      <li v-for="field in INFO_FIELDS" :key="field.id">
        <label :class="{ 'is-on': flags[field.id], 'is-locked': !editable }">
          <input
            type="checkbox"
            :checked="Boolean(flags[field.id])"
            :disabled="!editable"
            @change="emit('toggle', field.id, $event.target.checked)"
          />
          <span>{{ field.label }}</span>
        </label>
      </li>
    </ul>
    <div v-if="$slots.footer" class="flags-footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.flags {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 1.15rem 1.15rem 1.2rem;
  box-shadow: var(--shadow);
}

h3 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.4rem;
}

.flags-desc {
  margin: 0.3rem 0 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

ul {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.4rem;
}

label {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 42px;
  padding: 0.35rem 0.6rem;
  border-radius: 12px;
  background: var(--surface-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

label.is-on {
  background: color-mix(in srgb, var(--teal) 14%, var(--surface));
}

label.is-locked {
  cursor: default;
}

input {
  width: 1.05rem;
  height: 1.05rem;
  accent-color: var(--teal);
}

.flags-footer {
  margin-top: 0.95rem;
}
</style>
