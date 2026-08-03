<script setup>
import { computed } from 'vue'

// 12-точечный спарклайн: линия в приглушённом сером, текущий период — акцентная точка
const props = defineProps({
  values: { type: Array, required: true },
  width: { type: Number, default: 110 },
  height: { type: Number, default: 34 },
})

const pad = 4

const pts = computed(() => {
  const vs = props.values
  if (vs.length < 2) return []
  let min = Math.min(...vs)
  let max = Math.max(...vs)
  if (min === max) {
    min -= 1
    max += 1
  }
  const w = props.width - pad * 2
  const h = props.height - pad * 2
  return vs.map((v, i) => [
    pad + (i / (vs.length - 1)) * w,
    pad + h - ((v - min) / (max - min)) * h,
  ])
})

const path = computed(() => pts.value.map(([x, y]) => `${x},${y}`).join(' '))
const last = computed(() => pts.value[pts.value.length - 1])
</script>

<template>
  <svg
    v-if="pts.length"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
  >
    <polyline
      :points="path"
      fill="none"
      stroke="var(--spark)"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle :cx="last[0]" :cy="last[1]" r="3" fill="var(--accent)" stroke="var(--surface-1)" stroke-width="2" />
  </svg>
</template>
