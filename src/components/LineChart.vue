<script setup>
import { ref, computed } from 'vue'
import { useWidth, niceScale } from '../lib/useWidth'
import { fmtCompact, fmtFull, fmtTick, fmtBucket } from '../lib/format'

// Линейный график: 2px линии, заливка-«вуаль» 10% для одиночного ряда,
// crosshair-тултип со всеми рядами в точке, клавиатурная навигация ←/→.
const props = defineProps({
  xs: { type: Array, required: true }, // отметки времени (ms), общие для всех рядов
  series: { type: Array, required: true }, // [{ name, color, values: number[] }]
  unit: { type: String, default: 'day' },
  height: { type: Number, default: 230 },
  ariaLabel: { type: String, default: 'График' },
})

const wrap = ref(null)
const width = useWidth(wrap)
const hoverIdx = ref(null)

const padTop = 12
const padBottom = 26
const padRight = 18

const yDomain = computed(() => {
  let min = 0
  let max = 1
  let any = false
  for (const s of props.series) {
    for (const v of s.values) {
      if (!Number.isFinite(v)) continue
      if (!any) {
        min = Math.min(0, v)
        max = v
        any = true
      } else {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
  }
  return niceScale(min, Math.max(min + 1e-9, max), 4)
})

const padLeft = computed(() => {
  const longest = Math.max(...yDomain.value.ticks.map((t) => fmtCompact(t).length), 2)
  return Math.min(70, Math.max(34, longest * 7 + 8))
})

const plotW = computed(() => Math.max(10, width.value - padLeft.value - padRight))
const plotH = computed(() => props.height - padTop - padBottom)

function xAt(i) {
  const n = props.xs.length
  if (n <= 1) return padLeft.value + plotW.value / 2
  return padLeft.value + (i / (n - 1)) * plotW.value
}
function yAt(v) {
  const { min, max } = yDomain.value
  return padTop + plotH.value - ((v - min) / (max - min)) * plotH.value
}

const linePaths = computed(() =>
  props.series.map((s) => ({
    ...s,
    d: s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(''),
    endX: xAt(s.values.length - 1),
    endY: yAt(s.values[s.values.length - 1]),
  })),
)

// вуаль под линией — только для одиночного ряда
const areaPath = computed(() => {
  if (props.series.length !== 1 || props.xs.length < 2) return null
  const s = props.series[0]
  const base = padTop + plotH.value
  const top = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join('')
  return `${top}L${xAt(s.values.length - 1).toFixed(1)},${base}L${xAt(0).toFixed(1)},${base}Z`
})

const crossesYear = computed(() => {
  if (props.xs.length < 2) return false
  return new Date(props.xs[0]).getFullYear() !== new Date(props.xs[props.xs.length - 1]).getFullYear()
})

const xTicks = computed(() => {
  const n = props.xs.length
  if (n === 0) return []
  const maxTicks = Math.max(2, Math.floor(plotW.value / 74))
  const step = Math.max(1, Math.ceil(n / maxTicks))
  const idxs = []
  for (let i = 0; i < n; i += step) idxs.push(i)
  if (idxs[idxs.length - 1] !== n - 1 && n > 1) {
    if (xAt(n - 1) - xAt(idxs[idxs.length - 1]) < 50) idxs.pop()
    idxs.push(n - 1)
  }
  return idxs.map((i) => ({
    i,
    x: xAt(i),
    label: fmtTick(new Date(props.xs[i]), props.unit, crossesYear.value),
  }))
})

// подпись значения у конца линии — только для одиночного ряда (выборочная разметка)
const endLabel = computed(() => {
  if (props.series.length !== 1 || props.xs.length === 0) return null
  const s = linePaths.value[0]
  return { x: Math.min(s.endX - 8, width.value - 8), y: Math.max(12, s.endY - 10), text: fmtCompact(props.series[0].values.at(-1)) }
})

function idxFromEvent(e) {
  const rect = wrap.value.getBoundingClientRect()
  const px = e.clientX - rect.left
  const n = props.xs.length
  if (n <= 1) return n - 1
  const t = (px - padLeft.value) / plotW.value
  return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))))
}

function onMove(e) {
  hoverIdx.value = idxFromEvent(e)
}
function onLeave() {
  hoverIdx.value = null
}
function onKey(e) {
  const n = props.xs.length
  if (n === 0) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const d = e.key === 'ArrowRight' ? 1 : -1
    const cur = hoverIdx.value == null ? n - 1 : hoverIdx.value
    hoverIdx.value = Math.max(0, Math.min(n - 1, cur + d))
  } else if (e.key === 'Escape') {
    hoverIdx.value = null
  }
}

const tooltip = computed(() => {
  const i = hoverIdx.value
  if (i == null || i >= props.xs.length) return null
  const x = xAt(i)
  const flip = x > width.value - 190
  return {
    i,
    x,
    left: flip ? undefined : `${x + 14}px`,
    right: flip ? `${width.value - x + 14}px` : undefined,
    title: fmtBucket(new Date(props.xs[i]), props.unit),
    rows: props.series.map((s) => ({ name: s.name, color: s.color, value: fmtFull(s.values[i]) })),
  }
})
</script>

<template>
  <div
    ref="wrap"
    class="line-chart"
    tabindex="0"
    role="img"
    :aria-label="ariaLabel"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @keydown="onKey"
    @blur="onLeave"
  >
    <p v-if="xs.length === 0" class="empty">Нет данных за выбранный период</p>
    <svg v-else :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
      <!-- сетка: сплошные волосяные линии -->
      <g shape-rendering="crispEdges">
        <line
          v-for="t in yDomain.ticks"
          :key="t"
          :x1="padLeft"
          :x2="width - padRight"
          :y1="yAt(t)"
          :y2="yAt(t)"
          :stroke="t === 0 ? 'var(--axis)' : 'var(--grid)'"
          stroke-width="1"
        />
      </g>
      <!-- подписи осей -->
      <g class="tick-text">
        <text
          v-for="t in yDomain.ticks"
          :key="'y' + t"
          :x="padLeft - 6"
          :y="yAt(t) + 3.5"
          text-anchor="end"
        >
          {{ fmtCompact(t) }}
        </text>
        <text
          v-for="t in xTicks"
          :key="'x' + t.i"
          :x="Math.max(padLeft + 8, Math.min(t.x, width - 20))"
          :y="height - 8"
          text-anchor="middle"
        >
          {{ t.label }}
        </text>
      </g>
      <!-- crosshair -->
      <line
        v-if="tooltip"
        :x1="tooltip.x"
        :x2="tooltip.x"
        :y1="padTop"
        :y2="padTop + plotH"
        stroke="var(--axis)"
        stroke-width="1"
        shape-rendering="crispEdges"
      />
      <!-- данные -->
      <path v-if="areaPath" :d="areaPath" :fill="series[0].color" opacity="0.1" />
      <g v-for="s in linePaths" :key="s.name">
        <path :d="s.d" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <!-- маркер конца с кольцом цвета поверхности -->
        <circle :cx="s.endX" :cy="s.endY" r="4" :fill="s.color" stroke="var(--surface-1)" stroke-width="2" />
      </g>
      <text v-if="endLabel" :x="endLabel.x" :y="endLabel.y" text-anchor="end" class="end-label">
        {{ endLabel.text }}
      </text>
      <!-- точки под crosshair -->
      <g v-if="tooltip">
        <circle
          v-for="s in linePaths"
          :key="'h' + s.name"
          :cx="xAt(tooltip.i)"
          :cy="yAt(s.values[tooltip.i])"
          r="4.5"
          :fill="s.color"
          stroke="var(--surface-1)"
          stroke-width="2"
        />
      </g>
    </svg>

    <div v-if="tooltip" class="tooltip" :style="{ left: tooltip.left, right: tooltip.right, top: padTop + 'px' }">
      <div class="tooltip-title">{{ tooltip.title }}</div>
      <div v-for="r in tooltip.rows" :key="r.name" class="tooltip-row">
        <span class="tooltip-key" :style="{ background: r.color }" />
        <span class="tooltip-value">{{ r.value }}</span>
        <span class="tooltip-name">{{ r.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-chart {
  position: relative;
  outline-offset: 2px;
}
.empty {
  margin: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.tick-text text {
  font-size: 11px;
  fill: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.end-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-secondary);
}
.tooltip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  padding: 8px 10px;
  min-width: 120px;
  max-width: 220px;
}
.tooltip-title {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  white-space: nowrap;
}
.tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1.6;
}
/* ключ ряда — короткий штрих цвета серии, не квадрат */
.tooltip-key {
  width: 12px;
  height: 2.5px;
  border-radius: 1px;
  flex-shrink: 0;
}
/* значение — главное, имя ряда — вторично */
.tooltip-value {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.tooltip-name {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
