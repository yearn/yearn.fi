# bold.yearn.fi — yBOLD lander

A single-page acquisition and position-management experience for
[yBOLD](https://yearn.fi/v3/1/0x9F4330700a36B29952869fac9b33f45EEdd8A3d8), aimed at Liquity referral
traffic. The app keeps its own Reown AppKit, Wagmi, and React Query providers and consumes the shared local
`@yearn/vault-widget` workspace package for deposits and withdrawals.

## Develop

From the repository root:

```bash
bun run dev:ybold
```

The app runs on [http://127.0.0.1:3002](http://127.0.0.1:3002). It loads the same `.env` file from the repository
root as `apps/yearn`. For a fresh yBOLD-only checkout, initialize that shared file with:

```bash
cp apps/ybold/.env.example .env
```

If the root `.env` already exists, merge the variables from `apps/ybold/.env.example` instead of overwriting it.
Do not create an app-local `.env.local`. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is required. Reown AppKit owns
injected-wallet and WalletConnect discovery, connection UI, and reconnect; there is no separate project-ID-free
wallet fallback.

The shared widget reads spot prices from the host's `/api/prices/spot` endpoint. This app exposes a thin adapter
at that path which forwards to Yearn's public price API.

## Deploy on Vercel

Create a separate Vercel project for this app and set its Root Directory to
`apps/ybold`. Leave the detected Next.js build command and `.next` output at
their defaults, and enable access to files outside the root directory so the
build can use the root lockfile and `packages/vault-widget`.

The app-local `vercel.json` contains only the framework preset. Do not add a
root-level Vercel configuration that hardcodes another app's build command.

See [REOWN_APPKIT_CANARY.md](./REOWN_APPKIT_CANARY.md) for the canary boundary, compatibility findings, and
wallet/reconnect acceptance checks.
