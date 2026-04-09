# yearn.fi

![](./public/og.png)

### Initial Setup

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

- Optional: Create `.env` file in root directory of repo then copy contents of `.env.example` to `.env` and replace values with your own keys. If you do not do this the default values from `next.config.js` will be used.

    ``` bash
    cp .env.example .env
    ```

- Optional: Install Husky for pre-commit scripts.

    ``` bash
    bun add --dev husky
    ```

### Install and run

1. Run `bun install`
2. Run `bun run dev`
3. Open the browser and navigate to `http://localhost:3000`

### Per-vault Enso denylist (disable zaps)

To disable Enso routing for specific vaults, edit:

`src/components/pages/vaults/constants/ensoDisabledVaults.ts`

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

### Making Changes

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

### Pushing Changes to your Repo

- Commits are squashed when PR is merged so rebasing is optional
- When ready to push

    ``` bash
    git fetch
    git merge upstream/main
    git push origin <branch-name>
    ```

### Submitting Pull Request

- Go to your GitHub and navigate to your forked repo
- Click on `Pull requests` and then click on `New pull request`
- Click on `compare across forks`
- Click on `compare:` and select branch that you want to create a pull request for then click on `create pull request`

