<script setup>
// Легенда: обязательна при ≥2 рядах; ключ повторяет форму марки (line/rect)
defineProps({
  items: { type: Array, required: true }, // [{ name, color, kind: 'line' | 'rect' }]
})
</script>

<template>
  <div class="legend" role="list">
    <span v-for="it in items" :key="it.name" class="legend-item" role="listitem">
      <span
        :class="['legend-key', it.kind === 'rect' ? 'rect' : 'line']"
        :style="{ background: it.color }"
      />
      <span class="legend-name">{{ it.name }}</span>
    </span>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 10px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.legend-key.line {
  width: 14px;
  height: 3px;
  border-radius: 1.5px;
}
.legend-key.rect {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
