<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { parseSheetUrl, fetchSheet, sheetLink, errorMessage } from './lib/gviz'
import { loadFile } from './lib/fileLoad'
import { demoTable } from './lib/demo'
import {
  analyzeTable,
  applyFilters,
  dateExtent,
  chooseUnit,
  unitLabel,
  unitLabelAgg,
  trimPartialEdges,
  buildTimeline,
  computeKpis,
  aggregateByCategory,
  categorySlots,
  timelineByCategory,
  uniqueValues,
  COUNT_KEY,
} from './lib/analyze'
import { fmtFull } from './lib/format'
import FilterBar from './components/FilterBar.vue'
import StatTile from './components/StatTile.vue'
import ChartCard from './components/ChartCard.vue'
import LineChart from './components/LineChart.vue'
import BarChart from './components/BarChart.vue'
import LegendRow from './components/LegendRow.vue'
import DataTable from './components/DataTable.vue'
import ThemeToggle from './components/ThemeToggle.vue'

// ---------- состояние ----------

const status = ref('idle') // idle | loading | refreshing | ready | error
const error = ref('')
const table = ref(null)
const source = ref(null) // { kind: 'sheet', ref: {id,gid} } | { kind: 'file', name }
const urlInput = ref('')
const dragOver = ref(false)
const loadedAt = ref(null)

const filters = reactive({ preset: 'all', from: null, to: null, cats: {} })
const barMeasureSel = reactive({}) // colIndex -> measure key
const splitDim = ref(null)
const splitMeasure = ref(COUNT_KEY)

// ---------- загрузка ----------

async function loadSheet(input) {
  const parsed = parseSheetUrl(input)
  if (!parsed) {
    error.value = 'Это не похоже на ссылку на Google Таблицу. Нужна ссылка вида docs.google.com/spreadsheets/d/…'
    status.value = table.value ? 'ready' : 'error'
    return
  }
  status.value = table.value ? 'refreshing' : 'loading'
  error.value = ''
  try {
    const t = await fetchSheet(parsed)
    adoptTable(t, { kind: 'sheet', ref: parsed })
    const u = new URL(location.href)
    u.searchParams.set('sheet', input.trim())
    history.replaceState(null, '', u)
    localStorage.setItem('lastSheetUrl', input.trim())
  } catch (e) {
    error.value = errorMessage(e)
    status.value = table.value ? 'ready' : 'error'
  }
}

async function onFile(file) {
  if (!file) return
  status.value = table.value ? 'refreshing' : 'loading'
  error.value = ''
  try {
    const t = await loadFile(file)
    if (!t.cols.length) throw new Error('EMPTY')
    adoptTable(t, { kind: 'file', name: file.name })
    const u = new URL(location.href)
    u.searchParams.delete('sheet')
    history.replaceState(null, '', u)
  } catch (e) {
    error.value =
      e.message === 'EMPTY'
        ? 'Файл пустой или не удалось найти в нём таблицу.'
        : 'Не удалось разобрать файл. Поддерживаются CSV, TSV и Excel (.xlsx).'
    status.value = table.value ? 'ready' : 'error'
  }
}

function adoptTable(t, src) {
  table.value = t
  source.value = src
  loadedAt.value = new Date()
  status.value = 'ready'
  // новый набор данных — сбрасываем фильтры и выборы
  filters.preset = 'all'
  filters.from = null
  filters.to = null
  filters.cats = {}
  Object.keys(barMeasureSel).forEach((k) => delete barMeasureSel[k])
  splitDim.value = null
}

function refresh() {
  if (source.value?.kind === 'sheet') loadSheet(urlInput.value)
}

function changeSource() {
  status.value = 'idle'
  table.value = null
  source.value = null
  error.value = ''
}

function onDrop(e) {
  dragOver.value = false
  onFile(e.dataTransfer?.files?.[0])
}

function loadDemo() {
  adoptTable(demoTable(), { kind: 'file', name: 'Демо-данные: продажи' })
  const u = new URL(location.href)
  u.searchParams.delete('sheet')
  u.searchParams.set('demo', '1')
  history.replaceState(null, '', u)
}

onMounted(() => {
  const q = new URL(location.href).searchParams
  const fromQuery = q.get('sheet')
  if (fromQuery) {
    urlInput.value = fromQuery
    loadSheet(fromQuery)
  } else if (q.get('demo')) {
    loadDemo()
  } else {
    urlInput.value = localStorage.getItem('lastSheetUrl') || ''
  }
})

// ---------- анализ ----------

const analysis = computed(() => (table.value ? analyzeTable(table.value) : null))

const catFilterCols = computed(() => {
  if (!analysis.value) return []
  return analysis.value.categoryCols.slice(0, 3).map((c) => ({
    index: c.index,
    label: c.label,
    values: uniqueValues(table.value.rows, c.index),
  }))
})

const extent = computed(() => {
  const a = analysis.value
  if (!a || !a.timeCol) return null
  return dateExtent(table.value.rows, a.timeCol.index)
})

const filteredRows = computed(() => {
  if (!analysis.value) return []
  return applyFilters(table.value.rows, analysis.value.timeCol, filters)
})

const filteredExtent = computed(() => {
  const a = analysis.value
  if (!a || !a.timeCol) return null
  return dateExtent(filteredRows.value, a.timeCol.index)
})

const unit = computed(() =>
  filteredExtent.value ? chooseUnit(filteredExtent.value[0], filteredExtent.value[1]) : null,
)

const timeline = computed(() => {
  const a = analysis.value
  if (!a || !a.timeCol || !unit.value) return null
  const tl = buildTimeline(filteredRows.value, a.timeCol.index, a.measures, unit.value)
  return trimPartialEdges(tl, unit.value, filteredExtent.value)
})

const deltaLabel = computed(() =>
  unit.value ? 'к пред. ' + unitLabel(unit.value) : '',
)

const kpis = computed(() => {
  if (!analysis.value) return []
  return computeKpis(filteredRows.value, timeline.value, analysis.value.measures, 6)
})

// малые кратные: динамика каждого измерения (одиночный ряд — слот 1 + вуаль)
const timeCharts = computed(() => {
  const a = analysis.value
  if (!a || !timeline.value || timeline.value.length < 2) return []
  const xs = timeline.value.map((b) => b.t)
  return a.measures.slice(0, 6).map((m) => ({
    key: m.key,
    title: m.label,
    xs,
    series: [
      { name: m.label, color: 'var(--series-1)', values: timeline.value.map((b) => b.values[m.key]) },
    ],
  }))
})

// бары по категориям (топ-10 + «Прочее»), выбор измерения в шапке карточки
const defaultMeasureKey = computed(() => {
  const ms = analysis.value?.measures || []
  return ms.length > 1 ? ms[1].key : COUNT_KEY
})

function measureByKey(key) {
  return analysis.value.measures.find((m) => m.key === key) || analysis.value.measures[0]
}

const barCards = computed(() => {
  const a = analysis.value
  if (!a) return []
  return a.categoryCols.slice(0, 2).map((c) => {
    const selKey = barMeasureSel[c.index] || defaultMeasureKey.value
    const m = measureByKey(selKey)
    return {
      col: c,
      selKey,
      measure: m,
      items: aggregateByCategory(filteredRows.value, c.index, m, 10),
    }
  })
})

// динамика по категориям: топ-5 цветных + «Прочее» серым; цвета закреплены
// за категориями по полному набору данных — фильтры не перекрашивают
const splitAvailable = computed(
  () => !!(analysis.value?.timeCol && analysis.value.categoryCols.length && unit.value),
)

const splitDimIndex = computed(() =>
  splitDim.value != null ? splitDim.value : analysis.value?.categoryCols[0]?.index,
)

const splitChart = computed(() => {
  const a = analysis.value
  if (!splitAvailable.value || !timeline.value || timeline.value.length < 2) return null
  const m = measureByKey(splitMeasure.value)
  const slots = categorySlots(table.value.rows, splitDimIndex.value, m, 5)
  let { xs, series } = timelineByCategory(
    filteredRows.value,
    a.timeCol.index,
    splitDimIndex.value,
    m,
    unit.value,
    slots,
  )
  // синхронизируем с обрезанной динамикой: без неполных крайних бакетов
  const t0 = timeline.value[0].t
  const t1 = timeline.value[timeline.value.length - 1].t
  const keep = xs.map((t, i) => (t >= t0 && t <= t1 ? i : -1)).filter((i) => i >= 0)
  if (keep.length < xs.length) {
    xs = keep.map((i) => xs[i])
    series = series.map((s) => ({ ...s, values: keep.map((i) => s.values[i]) }))
  }
  const colored = series.map((s) => ({
    ...s,
    color: s.slot === 'other' ? 'var(--series-other)' : `var(--series-${s.slot})`,
  }))
  return {
    measure: m,
    xs,
    series: colored,
    legend: colored.map((s) => ({ name: s.name, color: s.color, kind: 'line' })),
  }
})

watch(defaultMeasureKey, (k) => {
  splitMeasure.value = k
})

const sourceLabel = computed(() => {
  if (!source.value) return ''
  return source.value.kind === 'file' ? source.value.name : 'Google Таблица'
})

const timeStamp = computed(() =>
  loadedAt.value
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(loadedAt.value)
    : '',
)
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span aria-hidden="true">📊</span>
        <span class="brand-name">Sheets Dashboard</span>
      </div>
      <div class="topbar-right">
        <template v-if="status === 'ready' || status === 'refreshing'">
          <a
            v-if="source?.kind === 'sheet'"
            class="btn"
            :href="sheetLink(source.ref)"
            target="_blank"
            rel="noopener"
          >
            Открыть таблицу ↗
          </a>
          <span v-else class="file-badge" :title="sourceLabel">📄 {{ sourceLabel }}</span>
          <button
            v-if="source?.kind === 'sheet'"
            class="btn"
            :disabled="status === 'refreshing'"
            @click="refresh"
          >
            ⟳ Обновить
          </button>
          <button class="btn" @click="changeSource">Сменить источник</button>
        </template>
        <ThemeToggle />
      </div>
    </header>

    <!-- ---------- лендинг / выбор источника ---------- -->
    <main v-if="status === 'idle' || status === 'loading' || status === 'error'" class="landing">
      <div class="chips">
        <span class="chip">Google Таблицы</span>
        <span class="chip">CSV</span>
        <span class="chip">Excel</span>
      </div>
      <h1>Дэшборд из вашей таблицы — <span class="grad">за секунды</span></h1>
      <p class="landing-sub">
        Вставьте ссылку или перетащите файл. Типы колонок определятся сами:
        KPI, динамика, разбивки по категориям и таблица.
      </p>

      <div class="card landing-card">
        <form class="url-row" @submit.prevent="loadSheet(urlInput)">
          <input
            v-model="urlInput"
            class="text-input"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            aria-label="Ссылка на Google Таблицу"
          />
          <button class="btn primary" type="submit" :disabled="status === 'loading'">
            {{ status === 'loading' ? 'Загрузка…' : 'Построить' }}
          </button>
        </form>
        <p class="hint">
          Таблица должна быть доступна по ссылке: Файл → Настройки доступа →
          «Все, у кого есть ссылка» → Читатель.
        </p>

        <div class="divider"><span>или</span></div>

        <label
          class="drop-zone"
          :class="{ over: dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            class="visually-hidden"
            @change="onFile($event.target.files[0]); $event.target.value = ''"
          />
          <span class="drop-icon" aria-hidden="true">📄</span>
          <span>Перетащите файл CSV или Excel сюда — или <u>выберите файл</u></span>
        </label>

        <p v-if="error" class="error-box" role="alert">{{ error }}</p>
      </div>

      <p class="privacy">🔒 Данные не отправляются на сервер — всё считается в вашем браузере.</p>
      <button class="btn demo-btn" @click="loadDemo">Попробовать на демо-данных</button>
    </main>

    <!-- ---------- дэшборд ---------- -->
    <main v-else class="dash-wrap">
      <p v-if="error" class="error-box" role="alert">{{ error }}</p>

      <div class="dash-meta">
        {{ fmtFull(table.rows.length) }} строк · {{ table.cols.length }} колонок
        <template v-if="timeStamp"> · загружено в {{ timeStamp }}</template>
      </div>

      <FilterBar
        v-model="filters"
        :has-time="!!analysis.timeCol"
        :extent="extent"
        :category-cols="catFilterCols"
      />

      <!-- при перезагрузке держим предыдущий рендер полупрозрачным -->
      <div class="dash" :class="{ refreshing: status === 'refreshing' }">
        <div v-if="filteredRows.length === 0" class="card empty-slice">
          По выбранным фильтрам нет ни одной строки.
        </div>

        <div class="kpi-row">
          <StatTile
            v-for="k in kpis"
            :key="k.key"
            :label="k.label"
            :value="k.total"
            :delta="k.delta"
            :delta-label="deltaLabel"
            :spark="k.spark"
          />
        </div>

        <div v-if="timeCharts.length" class="charts-grid">
          <ChartCard
            v-for="c in timeCharts"
            :key="c.key"
            :title="c.title"
            :subtitle="unitLabelAgg(unit)"
          >
            <LineChart :xs="c.xs" :series="c.series" :unit="unit" :aria-label="c.title" />
          </ChartCard>
        </div>

        <ChartCard
          v-if="splitChart"
          :title="splitChart.measure.label + ' по категориям'"
          :subtitle="
            unitLabelAgg(unit) +
            (splitChart.series.some((s) => s.slot === 'other') ? ' · топ-5 + Прочее' : '')
          "
          class="wide"
        >
          <template #controls>
            <select v-model="splitMeasure" aria-label="Показатель">
              <option v-for="m in analysis.measures" :key="m.key" :value="m.key">{{ m.label }}</option>
            </select>
            <select
              v-if="analysis.categoryCols.length > 1"
              :value="splitDimIndex"
              aria-label="Разбивка"
              @change="splitDim = +$event.target.value"
            >
              <option v-for="c in analysis.categoryCols" :key="c.index" :value="c.index">
                {{ c.label }}
              </option>
            </select>
          </template>
          <LineChart
            :xs="splitChart.xs"
            :series="splitChart.series"
            :unit="unit"
            :height="280"
            :aria-label="splitChart.measure.label + ' по категориям'"
          />
          <LegendRow :items="splitChart.legend" />
        </ChartCard>

        <div v-if="barCards.length" class="charts-grid">
          <ChartCard
            v-for="b in barCards"
            :key="b.col.index"
            :title="b.measure.label + ' — ' + b.col.label"
            :subtitle="b.items.some((i) => i.other) ? 'топ-10 + Прочее' : ''"
          >
            <template #controls>
              <select
                :value="b.selKey"
                aria-label="Показатель"
                @change="barMeasureSel[b.col.index] = $event.target.value"
              >
                <option v-for="m in analysis.measures" :key="m.key" :value="m.key">{{ m.label }}</option>
              </select>
            </template>
            <BarChart :items="b.items" :aria-label="b.measure.label + ' по ' + b.col.label" />
          </ChartCard>
        </div>

        <ChartCard title="Данные" :subtitle="'полный срез с учётом фильтров'" class="wide">
          <DataTable :columns="analysis.columns" :rows="filteredRows" />
        </ChartCard>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 20px 48px;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -20px 8px;
  padding: 10px 20px;
  background: color-mix(in srgb, var(--page) 82%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 650;
  font-size: 15px;
  letter-spacing: -0.2px;
  white-space: nowrap;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.file-badge {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- лендинг ---------- */
.landing {
  max-width: 620px;
  margin: 9vh auto 0;
  text-align: center;
}
.chips {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 18px;
}
.chip {
  font-size: 12px;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  background: var(--surface-1);
  border-radius: 999px;
  padding: 4px 12px;
}
.landing h1 {
  font-size: 34px;
  letter-spacing: -0.8px;
  line-height: 1.15;
  margin: 0 0 12px;
}
.grad {
  background: linear-gradient(90deg, var(--series-1), var(--series-7));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.landing-sub {
  color: var(--text-secondary);
  font-size: 15px;
  margin: 0 auto 26px;
  max-width: 480px;
}
.privacy {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 18px 0 0;
}
.landing-card {
  padding: 24px;
  text-align: left;
}
.url-row {
  display: flex;
  gap: 8px;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 10px 0 0;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  color: var(--text-muted);
  font-size: 12px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--grid);
}
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 16px;
  border: 1.5px dashed var(--axis);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: center;
}
.drop-zone.over {
  border-color: var(--accent);
  background: var(--hover-wash);
}
.drop-icon {
  font-size: 22px;
}
.demo-btn {
  margin-top: 10px;
  color: var(--text-secondary);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.error-box {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--delta-bad) 8%, transparent);
  color: var(--delta-bad);
  font-size: 13px;
}

/* ---------- дэшборд ---------- */
.dash-wrap {
  margin-top: 4px;
}
.dash-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.dash {
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: opacity 0.2s;
}
.dash.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.empty-slice {
  padding: 18px;
  color: var(--text-secondary);
  font-size: 13px;
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
}
.wide {
  width: 100%;
}

/* ---------- мобильные ---------- */
@media (max-width: 640px) {
  .page {
    padding: 0 12px 32px;
  }
  .topbar {
    margin: 0 -12px 8px;
    padding: 8px 12px;
  }
  .file-badge {
    display: none;
  }
  .landing {
    margin-top: 4vh;
  }
  .landing h1 {
    font-size: 26px;
  }
  .landing-card {
    padding: 18px;
  }
  .url-row {
    flex-direction: column;
  }
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .dash {
    gap: 12px;
  }
}
</style>
