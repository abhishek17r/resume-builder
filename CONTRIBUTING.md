# Contributing to refit

Thanks for helping. refit is two repositories: this app (React + Vite) and the [AI server](https://github.com/abhishek17r/resume-builder-api) (Node + Express). Most changes touch only one.

## Before you start

- **Bugs:** open an issue with steps to reproduce. For import problems, attach the file (or a version with personal details replaced) — parsing bugs are almost always about a specific layout.
- **Features:** open an issue first so we can agree on the approach. The product principles are in the README; proposals that fit them land fastest.
- **Licence:** contributions are accepted under the [AGPL-3.0](LICENSE) and the [Contributor License Agreement](CLA.md). The CLA bot asks you to sign on your first pull request.

## Develop

```bash
# both repositories side by side, e.g. refit/app and refit/api
cd app && npm install && npm run dev   # starts the app and, if found next to it, the AI server
```

- App: http://localhost:5190 · AI server: http://localhost:8787 (demo mode without an API key)
- `npm run dev:app` starts the app alone; `npm run build` must pass.
- AI server: `npm test` (runs in demo mode, no key needed).

## Guidelines

- **Keep the AI honest.** Anything that rewrites a user's content must not add facts, tools or numbers. New AI features come with a server-side guard and a test.
- **Local-first.** Resume data stays in the browser; the AI server only sees what a request needs.
- **Match the surrounding code:** small components, comments that say *why*, no new dependencies without a reason.
- **One change per pull request**, with a short description of what and why, and a screenshot for UI changes.
