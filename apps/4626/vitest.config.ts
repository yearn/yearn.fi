import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({ resolve: { alias: { '@erc4626': fileURLToPath(new URL('.', import.meta.url)) } } })
