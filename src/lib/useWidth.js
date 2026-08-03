import { ref, onMounted, onBeforeUnmount } from 'vue'

// Ширина контейнера через ResizeObserver — графики рендерятся в точных пикселях
export function useWidth(elRef, initial = 600) {
  const width = ref(initial)
  let ro = null
  onMounted(() => {
    if (!elRef.value) return
    width.value = elRef.value.clientWidth || initial
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w) width.value = w
    })
    ro.observe(elRef.value)
  })
  onBeforeUnmount(() => ro && ro.disconnect())
  return width
}

// «Красивые» деления оси: чистые числа 1/2/5×10ⁿ
export function niceScale(min, max, tickCount = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] }
  if (min === max) {
    if (min === 0) return { min: 0, max: 1, ticks: [0, 1] }
    min = Math.min(0, min)
    max = Math.max(0, max)
    if (min === max) return { min: 0, max: 1, ticks: [0, 1] }
  }
  const span = max - min
  const step0 = span / tickCount
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  const n = Math.round((hi - lo) / step)
  for (let i = 0; i <= n; i++) ticks.push(lo + i * step)
  return { min: lo, max: hi, ticks }
}
