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

** this is a test do not merge - 2 **
