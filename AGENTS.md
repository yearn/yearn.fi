# Repository Guidelines

See `CLAUDE.md` for the canonical project structure, commands, and workflow guidance.

## GitHub PR workflow

- For GitHub write operations in this repo, prefer GitHub CLI (`gh`) over the Codex GitHub connector.
- For pull request creation, use `gh pr create` by default.
- Do not use `codex_apps.github_create_pull_request` / `mcp__codex_apps__github_create_pull_request` unless the user explicitly asks to test or debug the connector.
- You may still use GitHub connector tools for read-only lookup when useful.
