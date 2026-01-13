# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

yearn-fi is Yearn Finance's main website and vaults interface - a Vite-based React 19 SPA for depositing/withdrawing from yield vaults across multiple blockchain networks.

## Development Commands

```bash
bun install           # Install dependencies
bun run dev           # Start Vite dev server (port 3000)
bun run build         # TypeScript check + Vite build
bun run preview       # Preview production build
bun run test          # Run Vitest suite
bun run lint          # Biome check
bun run lint:fix      # Biome format and fix
bun run tslint        # TypeScript type check only
bun run clean         # Clean build artifacts (runs clean.sh)
```

## Code Style & Naming Conventions

Enforced by Biome (biome.jsonc)—format frequently with `bun run lint:fix`:
- 2-space indentation
- Single quotes
- No trailing commas
- Optional semicolons (omit where possible)
- 120 character line width

Naming:
- Components: PascalCase (e.g., `VaultListRow.tsx`)
- Hooks: `useFoo` pattern (e.g., `useFilteredVaults.ts`)
- Utilities: camelCase (e.g., `format.ts`)
- Types: prefixed with `T` (e.g., `TSortDirection`, `TVaultType`)

## Best Practices

- Use functional style code
- Avoid comments where unnecessary
- Use explicit module imports and extract shared constants instead of duplicating literals across apps

## Architecture

### Directory Structure

```
src/                    # App entry and core shared code
├── main.tsx           # Vite entry point
├── App.tsx            # Root with context providers
├── routes.tsx         # React Router configuration
├── components/        # Core shared components
├── hooks/             # Core hooks (useThemePreference, usePlausible)
└── contexts/          # App-level contexts

pages/                  # Route pages (lazy-loaded)
├── vaults/            # Vault listing and detail pages
├── portfolio/         # Portfolio page
└── index.tsx          # Landing page

apps/                   # Feature-specific modules
├── lib/               # Shared library (components, hooks, utils)
│   ├── components/    # Buttons, Dropdowns, Headers, Icons
│   ├── contexts/      # useWallet, useYearn, useWeb3
│   ├── contracts/     # ABI source of truth
│   ├── hooks/         # Vault data, balances, filtering hooks
│   ├── utils/         # Format, calculations, chain constants
│   └── icons/         # 50+ icon components
├── vaults/            # Canonical vaults feature (list + detail + widget)
│   ├── components/    # Vaults UI (list, detail, widget, notifications)
│   ├── contexts/      # Vault settings context
│   ├── domain/        # Domain helpers (reports, normalization)
│   ├── hooks/         # Vault-specific hooks
│   ├── shared/        # Shared vault list/filter utilities
│   └── utils/         # Vault utilities (charts, yBOLD, filters)
└── landing/           # Landing page sections

api/                    # Vercel serverless functions
```

### Tech Stack

- **Framework**: React 19 + TypeScript 5.9 (strict mode)
- **Build**: Vite 7.2
- **Routing**: React Router 7.9
- **Styling**: Tailwind CSS 4
- **State**: TanStack Query 5, React Context
- **Web3**: Wagmi 2.18, Viem 2.38, RainbowKit 2.2

### Path Aliases (vite.config.ts)

- `@lib/*` → `apps/lib/*`
- `@vaults/*` → `apps/vaults/*`
- `@landing/*` → `apps/landing/*`

### Key Patterns

**Context Providers**: Nested in App.tsx - WalletContextApp → YearnContextApp → AppSettingsContextApp

**Data Flow**: Vault data fetched via useYearn context hooks, filtered/sorted via custom hooks in apps/lib/hooks

## Multi-Chain Support

Supported networks (configured in `apps/lib/utils/constants.tsx`):
- Ethereum (1), Optimism (10), Gnosis (100), Polygon (137), Fantom (250), Arbitrum (42161), Base (8453)

RPC URIs configured via environment variables: `RPC_URI_FOR_<chainId>`

## Environment Setup

Copy `.env.example` to `.env` and configure:
- RPC URIs for each chain
- WalletConnect project ID
- Yearn API endpoints (yDaemon, Kong REST)
