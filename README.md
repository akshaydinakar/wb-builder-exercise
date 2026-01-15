# WindBorne – Builder Exercise

Recommended Time Allocation: ~2-3 hours (Use of LLMs is encouraged)

## Instructions
You are building a "digital twin" for **California Power** (a fictional Utility company), to help their team gain clearer visibility into the current risk profile of their service territory (e.g. assets, infrastructure, vegetation, customers, natural hazards, etc.). 

Your team has built an initial prototype: an interactive map + info card that displays several data layers (substations, transmission lines, county boundaries) with basic styling. While functional, this experience is intentionally minimal and leaves significant room for improvement / feature expansion.

Your task is to extend this existing prototype codebase, with the holistic goal of improving operational visibility and decision-making around service territory health and risk.

Specifically, you are asked to:
1) Implement at least two frontend/UI changes that meaningfully improve the user’s ability to interpret, compare, or act on the existing data.
2) Add a new, value-adding data layer of your choosing to the map. Creativity is encouraged – feel free to use dummy data if needed.

Once you are satisfied with your code changes, create a ZIP file of all your code and submit it via email.
> Heads up! This is a public repository. We recommend that you clone this repository to your local device, and use Cursor (https://cursor.com/download) to make code changes.

## Requirements
- Keep changes frontend-only (no backend work required) - most of the frontend code lives in the MapView.tsx file.
- Email your submission as a ZIP file before the Presentation Interview (ideally 1 hr+ in advance).
- Along with your submission, include notes on the following:
  - What you changed
  - Why these changes matter 
  - What you’d do with more time

## Getting Started
1) Install core development tools on your device (CLI commands below):
  - Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)`
  - Git: `brew install git`
  - Node.js: `brew install node`
2) Download/install Cursor: https://cursor.com/download
3) Clone this GitHub repository to your local device.
4) Create a file named `.env.local` in the repository, and add the Mapbox token provided in the emailed instructions:
   VITE_MAPBOX_TOKEN=pk.XXXXXXXX
5) Type this command to run the application: `npm run dev`
6) Make any code changes you see fit. Good luck!

## Some Ideas...
- Visualize an asset attribute in a more intuitive or actionable way
- Aggregate individual data-points in a way that surfaces higher-level operational insight
- Add filters, search, or comparison to reduce cognitive load
- Improve asset styling on the map to better communicate priority or risk
- Make the info panel more decision-oriented (key fields, hierarchy, grouping)
- Improve map interactions (hover states, selection, multi-select, comparison)
