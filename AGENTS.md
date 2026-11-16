# AGENTS.md

Repo-local configuration for engineering skills.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default five-state triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain doc layout. See `docs/agents/domain.md`.

## Development workflow constraints

- **Versioning & rollback**: Keep changes traceable with small, focused commits/branches so updates can be reverted safely.
- **Local-first optimization**: Before pushing, batch related fixes locally and complete as much validation/fixing as possible in one pass to avoid frequent remote pushes/PR updates.
- **Release flow**: For updates, push a branch to the remote, create a Pull Request, merge it into `main`, then monitor the triggered GitHub Actions run until completion and report status/issues.
- **Deployment trigger**: Production deploy follows the repository workflow (currently push/merge to `main` triggers `.github/workflows/deploy.yml`, with theme controlled by repo variable `THEME` when applicable).
- **Verification**: Prefer running relevant checks/tests/builds (including target theme build when needed) before merge/push when the environment allows; if not possible, state what was not verified.
