# Product Engineer Builder Exercise (Frontend)

Timebox: ~3 hours (LLMs allowed)

## Goal
Make at least 2 concrete UI changes that unlock new value for an operator using this map-based interface.

## Context
Imagine a utility storm desk reviewing upcoming risk and critical assets. This starter app includes a small asset layer with a “criticality” property and basic UI scaffolding (toggles, legend, info panel).

## Requirements
- Make at least 2 meaningful UI/product improvements in code
- Keep changes frontend-only (no backend work required)
- Submit a PR
- In the PR description, include:
  - what you changed (2+ items)
  - why it matters (what decision/action it supports)
  - what you’d do next with more time

## Setup (Browser-only via Codespaces)
1) Open this repo in GitHub Codespaces
2) Create `.env.local` in the repo root:
   VITE_MAPBOX_TOKEN=pk.XXXXXXXX
   (We’ll provide the token — no Mapbox account required.)
3) Run: `npm run dev`
4) Open the forwarded port preview

## Example directions (optional)
- Improve the legend and risk communication
- Add filters or search
- Make the info panel more actionable (key fields, grouping, formatting)
- Improve map interaction (hover, selection state, multi-select/compare)