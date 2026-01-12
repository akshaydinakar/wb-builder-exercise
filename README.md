# WindBorne – Builder Exercise

Recommended Time Allocation: ~2-3 hours (Use of LLMs is encouraged)

## Instructions
You are building a "digital twin" for **California Power** (a fictional Utility company), to help their Grid Operations team gain clearer visibility into the current risk profile of their service territory (e.g. assets, infrastructure, vegetation, customers, natural hazards, etc.).

Your team has built an initial prototype: an interactive map + info card that displays several data layers (substations, transmission lines, county boundaries) with basic styling. While functional, this experience is intentionally minimal and leaves significant room for improvement / feature expansion.

Your task is to extend this prototype, with the holistic goal of improving visibility and decision-making around service territory health and risk.

Specifically, you are asked to:
1) Implement at least two frontend/UI changes that meaningfully improve the user’s ability to interpret, compare, or act on the existing data.
2) Add a new, value-adding data layer of your choosing to the map. Creativity is encouraged – feel free to use dummy data if needed.

Once you are satisfied with your changes, submit a pull request.
> Heads up! This is a public repository. You are welcome to work from a private fork. If you do, please add us as collaborators (our GitHub usernames are included in the emailed instructions).

## Requirements
- Keep changes frontend-only (no backend work required)
- Submit your work as a pull request
- In the pull request description, include:
  - What you changed
  - Why these changes matter 
  - What you’d do with more time

## Getting Started
1) Fork this repository.
2) Open the repository in GitHub Codespaces (where you can directly edit / test code changes).
3) Create a file named `.env.local` in the repository, and add the Mapbox token provided in the emailed instructions:
   VITE_MAPBOX_TOKEN=pk.XXXXXXXX
4) Open the built-in Terminal and type this command to run the application: `npm run dev`
5) Make any code changes you see fit. Good luck!

## Some Ideas...
- Visualize a relevant asset attribute in a more intuitive or actionable way
- Aggregate individual data-points in a way that surfaces higher-level operational insight
- Add filters, search, or comparison to reduce cognitive load
- Improve asset styling on the map to better communicate priority or risk
- Make the info panel more decision-oriented (key fields, hierarchy, grouping)
- Improve map interactions (hover states, selection, multi-select, comparison)
