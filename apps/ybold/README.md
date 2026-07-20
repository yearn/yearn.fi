# bold.yearn.fi — yBOLD lander

A single-page acquisition and position-management experience for
[yBOLD](https://yearn.fi/v3/1/0x9F4330700a36B29952869fac9b33f45EEdd8A3d8), aimed at Liquity referral
traffic. The app keeps its own Wagmi, React Query, and RainbowKit providers and consumes the shared local
`@yearn/vault-widget` workspace package for deposits and withdrawals.

## Develop

From the repository root:

```bash
bun run dev:ybold
```

The app runs on [http://127.0.0.1:3002](http://127.0.0.1:3002). Copy and configure its environment file:

```bash
cp apps/ybold/.env.example apps/ybold/.env.local
```

Without a WalletConnect project ID, local development falls back to injected browser wallets only.

The shared widget reads spot prices from the host's `/api/prices/spot` endpoint. This app exposes a thin adapter
at that path which forwards to Yearn's public price API.

## Deploy on Vercel

Create a separate Vercel project for this app and set its Root Directory to
`apps/ybold`. Leave the detected Next.js build command and `.next` output at
their defaults, and enable access to files outside the root directory so the
build can use the root lockfile and `packages/vault-widget`.

The app-local `vercel.json` contains only the framework preset. Do not add a
root-level Vercel configuration that hardcodes another app's build command.
