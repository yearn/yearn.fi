# Content Security Policy

yearn.fi enforces one CSP directive: `frame-ancestors`, defined in `next.config.ts`
(`FRAME_ANCESTORS`) and applied to every route via `headers()`.

```
Content-Security-Policy: frame-ancestors 'self' <allowlist>; report-uri <sentry>
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

**Resource directives** (`script-src`, `connect-src`, `img-src`, …) will be addressed in follow-up
work.

`report-uri` is formally deprecated in favour of the Reporting API, but has wider browser support and
is what the Sentry security endpoint accepts.
