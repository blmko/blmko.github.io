<script setup>
import { ref, computed } from 'vue'
import { fmtCompact, fmtFull } from '../lib/format'

// Горизонтальные бары: ≤24px толщиной, скруглённый конец-с-данными (4px),
// прямой у базовой линии; каждый бар подписан значением у конца.
// Марка — hit-target: hover подсвечивает ряд и показывает тултип.
const props = defineProps({
  items: { type: Array, required: true }, // [{ label, value, other? }]
  color: { type: String, default: 'var(--series-1)' },
  ariaLabel: { type: String, default: 'Диаграмма' },
})

const hoverIdx = ref(null)

const domain = computed(() => {
  const vals = props.items.map((i) => i.value)
  const min = Math.min(0, ...vals)
  const max = Math.max(0, ...vals)
  const span = max - min || 1
  return { min, max, span, zeroPct: ((0 - min) / span) * 100 }
})

function bar(v) {
  const { min, span, zeroPct } = domain.value
  const wPct = (Math.abs(v) / span) * 100
  if (v >= 0) return { left: zeroPct, width: wPct, neg: false }
  return { left: ((v - min) / span) * 100, width: wPct, neg: true }
}
</script>

<template>
  <div class="bar-chart" role="img" :aria-label="ariaLabel">
    <p v-if="items.length === 0" class="empty">Нет данных</p>
    <div
      v-for="(it, i) in items"
      :key="it.label"
      class="bar-row"
      :class="{ hovered: hoverIdx === i }"
      tabindex="0"
      @pointerenter="hoverIdx = i"
      @pointerleave="hoverIdx = null"
      @focus="hoverIdx = i"
      @blur="hoverIdx = null"
    >
      <span class="bar-label" :title="it.label">{{ it.label }}</span>
      <span class="bar-track">
        <span
          class="bar-fill"
          :class="{ neg: bar(it.value).neg }"
          :style="{
            left: bar(it.value).left + '%',
            width: Math.max(bar(it.value).width, 0.4) + '%',
            background: it.other ? 'var(--series-other)' : color,
          }"
        />
        <span
          class="bar-value"
          :style="
            bar(it.value).neg
              ? { right: 100 - bar(it.value).left + '%', paddingRight: '6px' }
              : { left: bar(it.value).left + bar(it.value).width + '%', paddingLeft: '6px' }
          "
        >
          {{ fmtCompact(it.value) }}
        </span>
      </span>
      <span v-if="hoverIdx === i" class="bar-tooltip">
        <span class="bar-tooltip-value">{{ fmtFull(it.value) }}</span>
        <span class="bar-tooltip-name">{{ it.label }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.bar-chart {
  display: flex;
  flex-direction: column;
}
.empty {
  margin: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.bar-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 6px;
}
.bar-row.hovered {
  background: var(--hover-wash);
}
.bar-label {
  flex: 0 0 132px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}
@media (max-width: 640px) {
  .bar-label {
    flex-basis: 96px;
  }
  .bar-track {
    margin-right: 48px;
  }
}
.bar-track {
  position: relative;
  flex: 1;
  height: 20px; /* ≤ 24px */
  margin-right: 56px; /* место под подпись значения */
}
.bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 0 4px 4px 0; /* скругление только на конце с данными */
  transition: opacity 0.1s;
}
.bar-fill.neg {
  border-radius: 4px 0 0 4px;
}
.bar-row.hovered .bar-fill {
  opacity: 0.85;
}
.bar-value {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.bar-tooltip {
  position: absolute;
  z-index: 5;
  right: 8px;
  top: -26px;
  pointer-events: none;
  display: flex;
  gap: 6px;
  align-items: baseline;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  padding: 5px 9px;
  font-size: 12px;
  max-width: 90%;
}
.bar-tooltip-value {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.bar-tooltip-name {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
