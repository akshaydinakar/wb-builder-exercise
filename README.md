# WindBorne – Product Engineer Builder Exercise

Recommended Time Allocation: ~2-3 hours (Use of LLMs is encouraged)

## Instructions
You are designing a digital twin of the PG&E service territory to help utility operators gain clearer, more actionable visibility into the health and risk profiles of their assets.

Your team has built an initial prototype: a map that displays several asset layers with basic styling, along with an interactive info card. While functional, this experience is intentionally minimal and leaves significant room for improvement.

Your task is to extend this prototype with the holistic design goal of improving operational visibility and decision-making around asset health and risk.

Specifically, you are asked to:
1) Implement at least two frontend/UI changes that meaningfully improve the user’s ability to interpret, compare, or act on the data.
2) Add at least one new, value-adding data layer of your choosing to the map. Creativity is encouraged – feel free to use dummy data if needed.

Once you are satisfied with your changes, submit a pull request.
> This is a public repository. You are welcome to work from a private fork. If you do, please add us as collaborators (our GitHub usernames are included in the emailed instructions).

## Requirements
- Keep changes frontend-only (no backend work required)
- Submit your work as a pull request
- In the pull request description, include:
  - What you changed (2+ items)
  - Why it matters (what decision/action it supports)
  - What you’d do next with more time

## Getting Started
1) Fork this repository.
2) Open the repo in GitHub Codespaces.
3) Create a file named `.env.local` in the repository, and add the Mapbox token provided in the emailed instructions:
   VITE_MAPBOX_TOKEN=pk.XXXXXXXX
4) Open the built-in Terminal and run the application: `npm run dev`
5) Make any code changes you see fit. Good luck!

## Some Ideas for Improvement
- Visualize a relevant asset attribute in a more intuitive or actionable way
- Aggregate data to surface higher-level operational insight
- Add filters, search, or comparison to reduce cognitive load
- Improve asset styling on the map to better communicate priority or risk
- Make the info panel more decision-oriented (key fields, hierarchy, grouping)
- Improve map interactions (hover states, selection, multi-select, comparison)