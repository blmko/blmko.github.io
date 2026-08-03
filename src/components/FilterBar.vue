<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

// Один ряд фильтров над всеми графиками: диапазон дат (пресеты списком,
// свой период — за волосяной чертой в футере) + фильтры по измерениям.
// Всё ниже перерисовывается против одного среза.
const props = defineProps({
  hasTime: { type: Boolean, default: false },
  extent: { type: Array, default: null }, // [minDate, maxDate] по данным
  categoryCols: { type: Array, default: () => [] }, // [{ index, label, values }]
  modelValue: { type: Object, required: true }, // { preset, from, to, cats }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const customFrom = ref('')
const customTo = ref('')

const PRESETS = [
  { id: 'all', label: 'Весь период' },
  { id: 'd7', label: 'Последние 7 дней' },
  { id: 'd30', label: 'Последние 30 дней' },
  { id: 'd90', label: 'Последние 90 дней' },
  { id: 'month', label: 'Последний месяц данных' },
  { id: 'year', label: 'Последний год данных' },
]

function presetRange(id) {
  if (!props.extent || id === 'all') return { from: null, to: null }
  const anchor = props.extent[1]
  const day = (n) =>
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - n + 1)
  if (id === 'd7') return { from: day(7), to: null }
  if (id === 'd30') return { from: day(30), to: null }
  if (id === 'd90') return { from: day(90), to: null }
  if (id === 'month') return { from: new Date(anchor.getFullYear(), anchor.getMonth(), 1), to: null }
  if (id === 'year') return { from: new Date(anchor.getFullYear(), 0, 1), to: null }
  return { from: null, to: null }
}

const buttonLabel = computed(() => {
  const f = props.modelValue
  if (f.preset === 'custom') {
    const d = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    return `${f.from ? d.format(f.from) : '…'} – ${f.to ? d.format(f.to) : '…'}`
  }
  return PRESETS.find((p) => p.id === f.preset)?.label || 'Весь период'
})

function pickPreset(id) {
  const { from, to } = presetRange(id)
  emit('update:modelValue', { ...props.modelValue, preset: id, from, to })
  open.value = false
}

function applyCustom() {
  const from = customFrom.value ? new Date(customFrom.value + 'T00:00:00') : null
  let to = customTo.value ? new Date(customTo.value + 'T23:59:59') : null
  if (from && to && to < from) to = null
  emit('update:modelValue', { ...props.modelValue, preset: 'custom', from, to })
  open.value = false
}

function setCat(index, value) {
  const cats = { ...props.modelValue.cats }
  if (value === '') delete cats[index]
  else cats[index] = value
  emit('update:modelValue', { ...props.modelValue, cats })
}

const hasActive = computed(
  () => props.modelValue.preset !== 'all' || Object.keys(props.modelValue.cats).length > 0,
)

function resetAll() {
  emit('update:modelValue', { preset: 'all', from: null, to: null, cats: {} })
}

// закрытие по клику вне поповера
function onDocDown(e) {
  if (!e.target.closest('.date-filter')) open.value = false
}
function toggle() {
  open.value = !open.value
  if (open.value) document.addEventListener('pointerdown', onDocDown)
  else document.removeEventListener('pointerdown', onDocDown)
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocDown))
</script>

<template>
  <div class="filter-bar">
    <div v-if="hasTime" class="date-filter">
      <button class="btn" @click="toggle" :aria-expanded="open">
        <span aria-hidden="true">📅</span> {{ buttonLabel }}
      </button>
      <div v-if="open" class="popover card">
        <button
          v-for="p in PRESETS"
          :key="p.id"
          class="preset-row"
          @click="pickPreset(p.id)"
        >
          <span class="check" aria-hidden="true">{{ modelValue.preset === p.id ? '✓' : '' }}</span>
          {{ p.label }}
        </button>
        <div class="popover-footer">
          <div class="custom-title">Свой период</div>
          <div class="custom-inputs">
            <input type="date" v-model="customFrom" aria-label="С даты" />
            <span class="dash">–</span>
            <input type="date" v-model="customTo" aria-label="По дату" />
            <button class="btn" @click="applyCustom">ОК</button>
          </div>
        </div>
      </div>
    </div>

    <label v-for="c in categoryCols" :key="c.index" class="cat-filter">
      <span class="cat-label">{{ c.label }}</span>
      <select
        class="combo"
        :value="modelValue.cats[c.index] ?? ''"
        @change="setCat(c.index, $event.target.value)"
      >
        <option value="">Все</option>
        <option v-for="v in c.values" :key="v" :value="v">{{ v }}</option>
      </select>
    </label>

    <button v-if="hasActive" class="btn reset" @click="resetAll">✕ Сбросить</button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.date-filter {
  position: relative;
}
.popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  min-width: 240px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}
.preset-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
}
.preset-row:hover {
  background: var(--hover-wash);
}
.check {
  width: 20px;
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
}
.popover-footer {
  border-top: 1px solid var(--grid); /* волосяная черта перед «своим периодом» */
  margin-top: 6px;
  padding: 10px 10px 6px;
}
.custom-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.custom-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}
.custom-inputs input {
  padding: 5px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  font-size: 12px;
  width: 118px;
}
.dash {
  color: var(--text-muted);
}
.cat-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cat-label {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.reset {
  color: var(--text-secondary);
}
</style>
