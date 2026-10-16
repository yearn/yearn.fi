# Yearn Earn — yTranche

The Earn and centered Earn UI from
[w84april/yTranche `separate-ui`](https://github.com/w84april/yTranche/pull/1),
imported from commit `738fdccc1727ead380ada7f000f0f9f7c6cbf579`.

This app consumes the same private `@yearn/vault-widget` and `@yearn/wallet-ui`
packages as Yearn and yBOLD. It has its own Wagmi and TanStack Query providers;
Reown AppKit, Ethers, and the prototype transaction implementation are not used.

From the workspace root:

```sh
bun install
bun run dev:ytranche
bun run tslint:ytranche
bun run build:ytranche
bun run preview:ytranche
```

Open http://127.0.0.1:3003. Routes: `/`, `/earn-centered`,
`/deposit` (redirects to `/#earn`), and `/api/products/usd-fixed`.
Copy `.env.example` to `.env.local` in this directory to customize Ethereum RPC
or enable WalletConnect. Injected wallets work without a WalletConnect project ID.

Deposits accept USDC on Ethereum into the senior Fixed tranche, `yvUSD-A`
(`0x2D4F47208853a3D20EADCbdA0F03900771C6Eba3`). Token routing and staking are
disabled. Withdrawals use explicit four-argument withdraw/redeem overloads with
`maxLoss = 0`, preserving the source app's loss policy. The controller target
is distinct from realized APR. The product endpoint exposes live tranche data.
Spot prices use the same public Yearn API adapter as yBOLD.

For Vercel, set Root Directory to `apps/ytranche` and enable access to files
outside the root directory. Use the detected Next.js build and output defaults.
