import { defineConfig } from 'vitest/config'
export default defineConfig({ resolve: { alias: { '@wrapped': import.meta.dirname } } })
