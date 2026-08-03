<script setup>
import { ref } from 'vue'

// Системная → светлая → тёмная. Выбор хранится в localStorage,
// index.html применяет его до первого рендера.
const MODES = [
  { id: 'auto', icon: '◐', title: 'Тема: как в системе' },
  { id: 'light', icon: '☀️', title: 'Тема: светлая' },
  { id: 'dark', icon: '🌙', title: 'Тема: тёмная' },
]

const current = ref(localStorage.getItem('theme') || 'auto')

function apply(mode) {
  current.value = mode
  if (mode === 'auto') {
    delete document.documentElement.dataset.theme
    localStorage.removeItem('theme')
  } else {
    document.documentElement.dataset.theme = mode
    localStorage.setItem('theme', mode)
  }
}

function cycle() {
  const i = MODES.findIndex((m) => m.id === current.value)
  apply(MODES[(i + 1) % MODES.length].id)
}
</script>

<template>
  <button
    class="btn theme-btn"
    :title="MODES.find((m) => m.id === current)?.title"
    @click="cycle"
  >
    {{ MODES.find((m) => m.id === current)?.icon }}
  </button>
</template>

<style scoped>
.theme-btn {
  width: 36px;
  justify-content: center;
  padding: 7px 0;
}
</style>
