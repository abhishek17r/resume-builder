# Offerstack

**One history. A resume for every job.** Offerstack is an open-source, local-first workbench for job seekers: keep everything you've done in one vault, build a resume tailored to each job in under a minute, and see exactly how well it matches. It runs on your machine; your resumes never leave your browser.

![Pasting a job description, building a tailored resume from the vault, checking the match and picking a design](public/demo/tailor-journey.gif)

[Quickstart](#quickstart) · [Features](#features) · [How the AI works](#how-the-ai-works-and-where-its-allowed-to-fail) · [Architecture](#architecture) · [Roadmap](#roadmap) · [Contributing](CONTRIBUTING.md)

## Why

Tailoring a resume for every application is the advice everyone gives and nobody has time for. Tools that do it with AI tend to make things up. Offerstack is built on four rules:

1. **Your history is the source of truth.** Every bullet you've written, across every version, lives in one deduplicated **vault**. Tailored resumes are assembled from it, never invented.
2. **AI suggests; it doesn't invent.** Rewrites keep your facts and numbers, and server-side guards reject edits that don't. Missing metrics become `[X]` placeholders for you to fill.
3. **Scores you can check.** The job match isn't a number an LLM made up: it's computed from requirement coverage, keywords and title fit, and shown piece by piece.
4. **Local-first.** No account, no cloud database. Resumes live in your browser; a small local server holds your API key and talks to the AI provider only when you ask.

## Quickstart

You need **Node.js 20+** and **git**. One line installs and starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/abhishek17r/resume-builder/main/install.sh | sh
```

Then open **http://localhost:5190**. AI features work in demo mode straight away; for the real thing, add a key to `offerstack/api/.env` and restart:

```bash
OPENAI_API_KEY=sk-...        # or
ANTHROPIC_API_KEY=sk-ant-...
```

<details>
<summary>Manual install</summary>

```bash
mkdir offerstack && cd offerstack
git clone https://github.com/abhishek17r/resume-builder.git app
git clone https://github.com/abhishek17r/resume-builder-api.git api
(cd api && npm install && cp .env.example .env)
cd app && npm install
npm run dev        # starts the app on :5190 and the AI server on :8787
```

`npm run dev` finds the AI server next to the app (`../api`, `../offerstack-api` or `../resume-builder-api`) and starts it too; `npm run dev:app` starts the app alone. If the server runs elsewhere, set `VITE_API_URL`.
</details>

## Features

**Vault: your career in one place**
- Built automatically from every resume you create or import; edit it freely and it keeps your edits.
- Deduplicated: the same bullet across versions is one entry with all its sources. A changed metric or a real rewrite keeps its own copy.
- Organised by company, role, project, education and skill, and by **your own tags** (Leadership, Cross-functional, Revenue & cost…). Tags are added automatically when your bullets or target jobs show a theme; add your own, or let AI suggest more.
- Every bullet is scored for impact and clarity, with one-click fixes and honest rewrites.
- Your profile (contact details, headlines) lives here too.

**Tailor to a job**
- Paste a job description: the job is analysed, your most relevant roles and bullets are chosen (every company stays in), and the title, summary, skills and bullets are lightly reworded in the job's terms, with every change listed.
- A **match score** you can read: requirements covered (must-haves weigh 3×), job keywords found, title fit.
- Tracked-change suggestions to push the match further, and "from your vault" picks for bullets you've written elsewhere.

**Write and design**
- Section editor with rich-text bullets, drag and drop, hidden entries, and quality markers from the checks.
- Ten distinct templates, type pairings, density presets and **fit to one page**, plus fine control of every font, size, colour and spacing. Your last design becomes the default for new resumes.
- A paginated preview that prints to PDF exactly as shown.

**Import**
- PDF, Word, text/Markdown, JSON backups, and LinkedIn (profile PDF or data export). Text, layout and design are read separately; choose a template or keep the original look.

## How the AI works (and where it's allowed to fail)

Every AI feature is a single structured call with a JSON schema: no chat, no agents. The server checks what comes back before the app sees it.

```mermaid
flowchart LR
  JD[Job description] --> A[Analyse<br/>requirements + keywords]
  V[(Vault)] --> C[Compose<br/>pick roles and bullets by ref]
  A --> C --> T[Tailor<br/>title, summary, light edits]
  T --> G{Guards}
  G -->|pass| R[Resume]
  G -->|fail| O[Keep the original text]
  R --> M[Match<br/>covered / partial / missing]
  M --> S[Score, computed in the app]
```

| Risk | Guard |
|---|---|
| Invented facts or numbers in a rewritten bullet | Rejected unless every number matches the original, the length stays within ~20% and most words are kept; no `[X]` placeholders when tailoring |
| A summary with made-up metrics | Every number must appear in your own material, or your original summary is kept |
| Skills you don't have | Only skills you listed or that your bullets show |
| Picking content that doesn't exist | Composition returns references only; unknown or mismatched references are dropped |
| A score that drifts between runs | The AI only labels each requirement; the number is computed deterministically from those labels plus exact keyword and title matches |

No API key? Every endpoint has a demo mode with keyword heuristics, so the whole app works offline.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React app] <--> DB[(IndexedDB<br/>resumes + vault)]
  end
  UI -- only what a request needs --> API[Local AI server<br/>Node + Express]
  API -- your key --> P[OpenAI or Anthropic]
```

- **App** (this repo): React 19, Vite, Tailwind, zustand. Custom paginated renderer; importers built on pdf.js and mammoth.
- **AI server** ([resume-builder-api](https://github.com/abhishek17r/resume-builder-api)): Express 5, Zod schemas shared across providers, prompt caching, rate limits, CORS locked to the app.

```
src/
  components/     UI: editor, design, optimise, vault, landing
  lib/import/     PDF / DOCX / LinkedIn readers
  lib/optimize/   quality rules, job-match score
  lib/vault/      sync, dedupe, tags, compose, scoring
  config/         app name, tag library
scripts/          dev launcher, demo GIF recorder
```

## Roadmap

- **Evals:** a public suite for honesty, edit fidelity, bullet selection, score stability and import accuracy, run on every prompt or model change.
- **Token economics:** cost and latency per feature, shown in the app.
- **Observability:** a local trace of every AI call, its guards and timing.
- **MCP server:** edit and style your resume from Claude, live in the preview.
- **Application tracker:** from job description to offer.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Contributions are accepted under the [CLA](CLA.md).

## Licence

[AGPL-3.0](LICENSE) © Abhishek Ranjan. You can use, modify and self-host Offerstack freely; if you offer a modified version as a network service, you must share its source under the same licence.
