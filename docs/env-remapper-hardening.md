# Env Remapper Hardening

## Summary
- Scope: `vite.config.ts`
- Goal: prevent accidental exposure of non-public env vars in client bundle.

## Changes
- Introduced `PUBLIC_ENV_ALLOWLIST` to enumerate server-side variables that may be exposed to the client.
- Early-return if env key already uses `VITE_` prefix, relying on Vite's native behaviour.
- Restricted RPC override aggregation to numeric chain IDs with non-empty values.
- Preserved `INFURA_KEY` mapping to `VITE_INFURA_PROJECT_ID` for backwards compatibility.
- Avoid emitting a `define` block when nothing needs to be injected, keeping Vite output untouched by default.

## Impact
- Secrets without `VITE_` prefix now remain server-side, closing the leakage vector from the previous auto-mapping logic.
- Deployment environments must continue to set client-facing variables explicitly (either with `VITE_` prefix or present in the allowlist).
- The RPC map still functions, but now rejects malformed chain IDs.
