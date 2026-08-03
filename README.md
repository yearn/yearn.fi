# yearn.fi

![](./apps/yearn/public/og.png)

## Initial setup

- Fork the [original repo](https://github.com/yearn/yearn.fi) into your GitHub account
- Clone the forked repo from your GitHub account to your local machine

    ``` bash
    git clone https://github.com/<your-gh>/yearn.fi.git
    ```

- Set origin to your fork. This is where you push your changes to. This is done automatically by the step above.

    ``` bash
    git remote add origin https://github.com/<your-gh>/yearn.fi
    ```

- Set upstream to original repo.

    ``` bash
    git remote add upstream https://github.com/yearn/yearn.fi.git
    ```

- Optional: Create a root `.env` for the Yearn app from its checked-in example and replace values with your own keys. The root commands load this file before starting `apps/yearn`. Client-readable values must use the `NEXT_PUBLIC_` prefix; server-only secrets must stay unprefixed.

    ``` bash
    cp apps/yearn/.env.example .env
    ```

- Optional: Install Husky for pre-commit scripts.

    ``` bash
    bun add --dev husky
    ```

## Install and run

Use Node 22 (the repository pins a compatible version in `.nvmrc`) and Bun. Node 20 is supported from 20.19 onward.

Install every workspace dependency once from the repository root:

```bash
bun install
```

Run either app with its root alias:

| App | Command | URL |
| --- | --- | --- |
| Yearn | `bun run dev` or `bun run dev:yearn` | [http://127.0.0.1:3000](http://127.0.0.1:3000) |
| yBOLD | `bun run dev:ybold` | [http://127.0.0.1:3002](http://127.0.0.1:3002) |

To run both, start the two commands in separate terminals. For yBOLD-specific settings, copy its environment example first:

```bash
cp apps/ybold/.env.example apps/ybold/.env.local
```

The workspace commands can also be run directly:

```bash
bun run --cwd apps/yearn dev
bun run --cwd apps/ybold dev
```

The Yearn Next config loads the workspace-root `.env` for both command forms, so secrets remain centralized outside the app workspace.

## Workspace architecture

Both products are first-class apps. The deposit/withdraw implementation is a third workspace that either app can consume:

```text
yearn.fi/
├── apps/
│   ├── yearn/                 # Main Next.js app and Yearn host adapters
│   └── ybold/                 # yBOLD Next.js app and yBOLD host adapters
├── packages/
│   └── vault-widget/          # Reusable widget UI and transaction logic
├── scripts/
├── package.json               # Workspace commands and dependency graph
└── bun.lock                   # One lockfile for every workspace
```

```text
apps/yearn ─┐
            ├──> @yearn/vault-widget
apps/ybold ─┘
```

The dependency direction is deliberately one-way: apps may import packages, but `packages/vault-widget` must never import an app or reach outside its own package. The widget owns its UI, deposit/withdraw transaction flows, reusable hooks, contracts, types, presets, and styles. Each app owns pages and APIs plus its Wagmi, React Query, wallet, chain, price, notification, analytics, asset, and routing integrations. Apps provide those integrations through `VaultWidgetRuntimeProvider`.

`@yearn/vault-widget` is private and source-distributed inside this repository. Bun resolves `"workspace:*"` to the local workspace, and each Next app transpiles that TypeScript source. This lets the apps share one implementation without publishing Yearn's widget to npm. Third-party dependencies are still installed normally and remain covered by the single reviewed lockfile.

### Build and validate

```bash
bun run build                # Yearn
bun run build:ybold          # yBOLD
bun run build:all            # Widget and both apps
bun run check:widget         # Widget types, tests, boundary, and build
bun run check:workspaces     # Widget and both app checks
bun run check:vault-widget-boundary
```

The boundary check scans imports in `packages/vault-widget/src` and fails if package code uses a host alias, imports an app workspace, or escapes the package through a relative path.

### Add another app

1. Create `apps/<name>/package.json` with `"private": true` and a unique package name.
2. Add `"@yearn/vault-widget": "workspace:*"` to that app's dependencies.
3. Add `@yearn/vault-widget` to the app's Next.js `transpilePackages` setting.
4. Import `@yearn/vault-widget/styles.css` and include `packages/vault-widget/src` in the app's Tailwind sources.
5. Mount the app's wallet/query providers and pass its adapters to `VaultWidgetRuntimeProvider`.
6. Add optional root run/check aliases, then validate the widget and the new app.

Keep a single root `bun.lock`; do not add lockfiles inside apps or packages.

See [`packages/vault-widget/README.md`](./packages/vault-widget/README.md) for the reusable API and host integration contract.

### Deploy

The root `vercel.json` keeps the existing Yearn project deployable from the repository root and points Vercel at `apps/yearn/.next`. Deploy yBOLD as a separate Vercel project with `apps/ybold` as its Root Directory; each app remains independently deployable while consuming the same workspace package.

## Per-vault Enso denylist (disable zaps)

To disable Enso routing for specific vaults, edit:

`apps/yearn/src/components/pages/vaults/constants/ensoDisabledVaults.ts`

Add vault addresses under their chain ID:

```ts
const ENSO_DISABLED_VAULTS_BY_CHAIN: Partial<Record<number, readonly Address[]>> = {
  1: [
    '0x1111111111111111111111111111111111111111'
  ],
  42161: [
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333'
  ]
}
```

Notes:
- Keys are EVM chain IDs (`1`, `10`, `137`, `42161`, etc.).
- Values are vault addresses for that chain.
- Address casing does not matter (addresses are normalized internally).
- Denylisted vaults disable Enso for both deposit and withdraw flows and hide zap UI on vault pages.

## Making changes

- Create a new local branch from upstream/main for each PR that you will submit

    ``` bash
    git fetch
    git checkout -b <your branch name> upstream/main
    ```

- Commit your changes as you work

    ``` bash
    git add .
    git commit -S -m "message"
    ```

  - [info about verified commits](https://docs.github.com/en/github/authenticating-to-github/managing-commit-signature-verification)

## Pushing changes to your repo

- Commits are squashed when PR is merged so rebasing is optional
- When ready to push

    ``` bash
    git fetch
    git merge upstream/main
    git push origin <branch-name>
    ```

## Submitting a pull request

- Go to your GitHub and navigate to your forked repo
- Click on `Pull requests` and then click on `New pull request`
- Click on `compare across forks`
- Click on `compare:` and select branch that you want to create a pull request for then click on `create pull request`
