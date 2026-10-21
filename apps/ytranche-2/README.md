# yTranche 2

A separate minimal yTranche app (`@yearn/ytranche-2`): the shared Yearn header and a USDC deposit/withdraw
widget centered on a white background. The page reuses the private
`@yearn/site-header`, `@yearn/vault-widget`, and `@yearn/wallet-ui` packages.
It has its own Wagmi and TanStack Query providers;
Reown AppKit, Ethers, and the prototype transaction implementation are not used.

From the workspace root:

```sh
bun install
bun run dev:ytranche-2
bun run tslint:ytranche-2
bun run build:ytranche-2
bun run preview:ytranche-2
```

Open http://127.0.0.1:3006. The widget is at `/`; `/earn-centered` redirects
to `/`, and `/deposit` redirects to `/#earn`. Live product data remains available
at `/api/products/usd-fixed`.
Copy `.env.example` to `.env.local` in this directory to customize Ethereum RPC
or enable WalletConnect. Injected wallets work without a WalletConnect project ID.

Deposits accept USDC on Ethereum into the senior Fixed tranche, `yvUSD-A`
(`0x2D4F47208853a3D20EADCbdA0F03900771C6Eba3`). Token routing and staking are
disabled. Withdrawals use explicit four-argument withdraw/redeem overloads with
`maxLoss = 0`, preserving the source app's loss policy. The controller target
is distinct from realized APR. The product endpoint exposes live tranche data.
Spot prices use the same public Yearn API adapter as yBOLD.

For Vercel, set Root Directory to `apps/ytranche-2` and enable access to files
outside the root directory. Use the detected Next.js build and output defaults.
