# Task 01 — Project scaffold

**Depends on:** —
**Refs:** Design.md §1, §5, §7

## Goal

A running Vite + React + TypeScript app with routing, dark theme tokens, and the project structure from Design.md §5.

## Steps

1. `npm create vite@latest` (react-ts template) in repo root; init git.
2. Add `react-router` with routes `/` (standings), `/races`, `/replay/:round` — placeholder pages.
3. Create `theme.css` with the design tokens (background `#0a0a0f`, panel `#15151e`, text `#f0f0f5`, muted `#8a8a99`) and base typography (tabular numerals).
4. App shell: top nav with links to Standings and Races, dark background applied.
5. Create empty directories per Design.md §5 (`src/api`, `src/replay`, `src/pages`, `src/components`, `scripts`).

## Verify

- `npm run dev` serves the app; all three routes render their placeholder.
- `npm run build` passes with no TS errors.
