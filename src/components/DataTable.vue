<script setup>
import { ref, computed, watch } from 'vue'
import { fmtCell } from '../lib/format'

// Таблица-двойник: каждое значение дэшборда достижимо и без графиков.
const props = defineProps({
  columns: { type: Array, required: true }, // из analyzeTable
  rows: { type: Array, required: true },
})

const limit = ref(50)
watch(
  () => props.rows,
  () => (limit.value = 50),
)

const visible = computed(() => props.rows.slice(0, limit.value))

function isNumeric(col) {
  return col.type === 'number'
}

function exportCsv() {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const head = props.columns.map((c) => esc(c.label)).join(';')
  const body = props.rows
    .map((r) => props.columns.map((c) => esc(fmtCell(r[c.index], c.type))).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'data.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="{ num: isNumeric(c) }"
            >
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in visible" :key="i">
            <td v-for="c in columns" :key="c.key" :class="{ num: isNumeric(c) }">
              {{ fmtCell(r[c.index], c.type) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-footer">
      <span class="muted">Показано {{ visible.length }} из {{ rows.length }}</span>
      <span class="spacer" />
      <button v-if="limit < rows.length" class="btn" @click="limit += 200">Показать ещё</button>
      <button class="btn" @click="exportCsv">Скачать CSV</button>
    </div>
  </div>
</template>

<style scoped>
.table-scroll {
  overflow: auto;
  max-height: 440px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12.5px;
}
th {
  position: sticky;
  top: 0;
  background: var(--surface-1);
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-bottom: 1px solid var(--axis);
  white-space: nowrap;
}
td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--grid);
  color: var(--text-primary);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* числа выравниваются по правому краю, tabular-nums — только в колонках */
th.num,
td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.table-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.muted {
  font-size: 12px;
  color: var(--text-muted);
}
.spacer {
  flex: 1;
}
</style>
