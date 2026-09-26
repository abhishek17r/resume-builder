# Resume Builder

A resume editor that runs in the browser: write your content, pick a design, and export a pixel-perfect PDF. Resumes are stored locally in IndexedDB.

## Features

- **Content**: section-based editor (experience, education, skills, projects, …) with rich-text bullets, drag-and-drop ordering and hidden entries.
- **Customize**: 10 templates, layouts (one/two/mix columns), 40+ fonts, spacing, colours, headings, header, photo, links and footer.
- **Optimize**:
  - *Quality score*: instant rule-based checks across ATS readiness, impact, clarity and completeness, with one-click fixes and AI rewrites for flagged bullets.
  - *Tailor to a job*: paste a job description → requirements, coverage map and match score → tracked-change suggestions to accept, edit or dismiss, or apply to a new tailored copy.
- **Import**: PDF, Word, text/Markdown, JSON backups, LinkedIn profile PDF or LinkedIn data-export ZIP.
- **Many versions**: labels, duplicates and tailored copies per job.
- **Export**: paginated preview that prints to PDF exactly as shown.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (or pass --port)
```

The Optimize tab's AI features call **[resume-builder-api](../resume-builder-api)** (Node + Claude API). Start it alongside the frontend; set `VITE_API_URL` if it isn't on `http://localhost:8787`. Quality checks work without it.

## Layout

```
src/
  components/        UI (ContentPanel, CustomizePanel, OptimizePanel, Preview, ResumeDocument…)
  lib/
    store.js         zustand store (persisted to IndexedDB) with undo/redo
    import/          PDF/DOCX/text/LinkedIn importers (text, layout and design passes)
    optimize/        quality rules, bullet helpers, API payload, edit application
    templates.js     design templates
    api.js           client for resume-builder-api
```
