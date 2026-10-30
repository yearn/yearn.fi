# Content Security Policy

yearn.fi enforces one CSP directive, `frame-ancestors`, and reports two more, `script-src` and
`connect-src`. All are defined in `apps/yearn/next.config.ts` and applied to every route via `headers()`.

```
Content-Security-Policy: frame-ancestors 'self' <allowlist>; report-uri <sentry>
Content-Security-Policy-Report-Only: script-src <SCRIPT_SRC>; connect-src <CONNECT_SRC>; report-uri <sentry>
```

## What it does

`frame-ancestors` controls who may embed yearn.fi in their iframe. It is the anti-clickjacking
control: without it, a phishing site can frame the real app so a user signs a transaction while
looking at an attacker-controlled page.

The allowlist covers the integrations that legitimately embed us — the Safe App, Blockscout
explorers, Coin98 — and was derived from several months of report-only telemetry in the Sentry
`yearnfi` project. `report-uri` stays attached to the enforced policy so blocked framing keeps
arriving in Sentry instead of failing silently.

Not to be confused with `frame-src`, which controls the opposite direction — which iframes *we* may
open. `frame-src` offers no clickjacking protection, since an attacker sets their own policy. Only
the header on the framed page can stop them.

## What about other CSP headers

**`X-Frame-Options`** only accepts `DENY` or `SAMEORIGIN`, so it cannot express a multi-origin
allowlist. Setting it would break the same embeds `frame-ancestors` exists to permit.

**`script-src` and `connect-src`** limit the damage of a compromised bundled dependency.
`connect-src` blocks exfiltration to an attacker host. `script-src` blocks loading a second-stage
payload. `script-src` is a host allowlist. It keeps `'unsafe-inline'` for the Next.js hydration
bootstrap and the theme script in `app/layout.tsx`. Nonces are out of scope.

`CONNECT_SRC` contains:

- RPC origins. For each chain in `canonicalChains`, the list contains the origins of
  `NEXT_PUBLIC_RPC_URI_FOR_<chainId>` and `NEXT_PUBLIC_TENDERLY_RPC_URI_FOR_<chainId>`, read at
  build time. It also contains viem's `rpcUrls.default.http[0]`, because `buildTransports` always
  appends a bare `http()` fallback. Set the env var for every chain in each deployment.
- Kong, Clusters, DefiLlama, Curve, jsDelivr (token lists), and WalletConnect relay, pulse, verify, and rpc.

`apps/ybold` and `apps/4626` serve the same report-only header. Their `connect-src` contains the RPC
URLs from `lib/rpc.ts` and WalletConnect. 4626 also contains Kong and `yearn.fi` (Enso balances).

Both directives are report-only. To enforce them, review the Sentry `yearnfi` CSP reports for one
collection window, add the origins you verified, and then move the two directives into the
`Content-Security-Policy` header.

**Owner.** These allowlists break silently when a provider or an SDK changes. A person who bumps
viem, wagmi, RainbowKit, or WalletConnect, or who adds a client-side fetch to a new origin, must
update `CONNECT_SRC`.

**Known limits.** User-added token lists (`WithTokenList.tsx`, localStorage `extraTokenlists`)
fetch arbitrary origins. After enforcement, those fetches fail. `img-src`, `frame-src`, and
`default-src` are out of scope.

`report-uri` is formally deprecated in favour of the Reporting API, but has wider browser support and
is what the Sentry security endpoint accepts.
