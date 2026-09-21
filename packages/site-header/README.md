# Shared Yearn header

`SiteHeader` and `HeaderNavMenu` are the standard Yearn masthead and desktop navigation, extracted from `apps/yearn`. Both the main Yearn app and the ERC-4626 utility consume them. Wallet state, account menus and mobile wallet actions remain owned by each app.

Provide `actions` and, optionally, a `navigation` slot to `SiteHeader`. Set `siteBaseUrl="https://yearn.fi"` in standalone apps so Yearn navigation and image URLs resolve to the main site. The main Yearn app leaves it empty for local routing.

Consumers must scan `packages/site-header/src` in their Tailwind sources, supply the standard semantic color tokens, and set `--header-height: 4.25rem`. The optional `themes.css` and `theme` exports provide Yearn's existing theme tokens and persisted theme preference. No wallet or data providers are required by this package.

`AccountDropdown` and `AccountMenu` from `@yearn/site-header/account` share Yearn's connected-wallet view and theme settings. Hosts supply wallet identity, activity and actions; portfolio valuation is optional. App-specific advanced settings are supplied as a slot. `AccountMenu` can also be mounted inside a mobile drawer or dialog.
