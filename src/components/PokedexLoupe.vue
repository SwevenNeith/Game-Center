<script setup>
defineProps({
  label: { type: String, default: 'Voir la fiche Pokédex' },
})

defineEmits(['click'])
</script>

<template>
  <button type="button" class="loupe" :aria-label="label" @click.stop="$emit('click')">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="2.2" />
      <path d="M15.4 15.4 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.loupe {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface) 88%, var(--teal));
  color: var(--ink);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--ink) 12%, transparent);
}

.loupe svg {
  width: 22px;
  height: 22px;
}
</style>
