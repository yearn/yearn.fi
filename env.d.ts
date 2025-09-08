/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMOL_ASSETS_URL: string
  readonly VITE_YEARN_API_BASE_URL: string
  readonly VITE_BASE_YEARN_ASSETS_URI: string
  readonly VITE_YEARN_BASE_URI: string
  readonly VITE_CHAINS_URI: string
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_PUBLIC_INFURA_PROJECT_ID: string
  readonly VITE_PUBLIC_SENTRY_DSN: string
  readonly VITE_ENV: string
  readonly VITE_VERCEL_URL: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}