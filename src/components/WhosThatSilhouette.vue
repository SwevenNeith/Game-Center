<script setup>
defineProps({
  artworkUrl: { type: String, default: '' },
  revealed: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
</script>

<template>
  <div class="stage" role="status">
    <p v-if="loading" class="stage__hint">Chargement…</p>
    <p v-else-if="error" class="stage__error">{{ error }}</p>
    <div
      v-else-if="artworkUrl"
      class="silhouette"
      :class="{ 'silhouette--revealed': revealed }"
    >
      <img
        :src="artworkUrl"
        alt="Silhouette d'un Pokémon mystère"
        width="475"
        height="475"
        decoding="async"
      />
    </div>
  </div>
</template>

<style scoped>
.stage {
  min-height: 16rem;
  display: grid;
  place-items: center;
  padding: 0.75rem 0.5rem;
}

.stage__hint {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.92rem;
}

.stage__error {
  margin: 0;
  max-width: 22rem;
  text-align: center;
  color: #8a3d32;
  font-weight: 600;
}

.silhouette {
  width: min(100%, 22rem);
}

.silhouette img {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(58svh, 22rem);
  margin-inline: auto;
  object-fit: contain;
  filter: brightness(0);
  transition: filter 0.6s ease;
}

.silhouette--revealed img {
  filter: brightness(1);
}
</style>
