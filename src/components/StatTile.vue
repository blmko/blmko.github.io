<script setup>
import { computed } from 'vue'
import { fmtCompact, fmtFull, fmtDelta } from '../lib/format'
import Sparkline from './Sparkline.vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  delta: { type: Number, default: null }, // доля: 0.12 = +12%
  deltaLabel: { type: String, default: '' },
  spark: { type: Array, default: null },
})

const deltaText = computed(() => fmtDelta(props.delta))
</script>

<template>
  <div class="card tile">
    <div class="tile-main">
      <div class="tile-label">{{ label }}</div>
      <div class="tile-value" :title="fmtFull(value)">{{ fmtCompact(value) }}</div>
      <div v-if="deltaText" class="tile-delta" :class="delta >= 0 ? 'up' : 'down'">
        <span aria-hidden="true">{{ delta >= 0 ? '▲' : '▼' }}</span>
        {{ deltaText }}
        <span v-if="deltaLabel" class="tile-delta-label">{{ deltaLabel }}</span>
      </div>
    </div>
    <Sparkline v-if="spark && spark.length >= 2" :values="spark" class="tile-spark" />
  </div>
</template>

<style scoped>
.tile {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  min-width: 0;
}
.tile-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* крупное число — пропорциональные цифры (без tabular-nums) */
.tile-value {
  font-size: clamp(21px, 5.5vw, 26px);
  font-weight: 600;
  line-height: 1.2;
  margin-top: 2px;
  color: var(--text-primary);
}
@media (max-width: 640px) {
  .tile {
    padding: 12px 14px;
  }
  .tile-spark {
    display: none; /* на узких плитках спарклайн не читается */
  }
}
.tile-delta {
  font-size: 12px;
  margin-top: 2px;
}
.tile-delta.up {
  color: var(--delta-good);
}
.tile-delta.down {
  color: var(--delta-bad);
}
.tile-delta-label {
  color: var(--text-muted);
}
.tile-spark {
  flex-shrink: 0;
}
</style>
