import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' — собранную статику можно класть в любой подкаталог сервера
export default defineConfig({
  plugins: [vue()],
  base: './',
})
