<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <section class="card chart-card">
    <header class="chart-card-head">
      <div>
        <h3 class="chart-card-title">{{ title }}</h3>
        <p v-if="subtitle" class="chart-card-subtitle">{{ subtitle }}</p>
      </div>
      <div class="chart-card-controls"><slot name="controls" /></div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.chart-card {
  padding: 16px;
  min-width: 0;
}
.chart-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 10px;
}
.chart-card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.chart-card-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.chart-card-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.chart-card-controls select {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  font-size: 12px;
  max-width: 180px;
}
</style>
