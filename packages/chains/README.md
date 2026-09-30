# @yearn/chains

Shared chain metadata, app profiles, pure selectors, RPC configuration helpers and offline validation. This package imports no applications, React, environment variables or network clients.

See [chain onboarding instructions](../../docs/chain-management.md). Register chain facts in `src/registry.ts` and enable apps/features in `src/profiles.ts`.

```sh
bun run chains:check
bun run test:chains
bun run tslint:chains
```
