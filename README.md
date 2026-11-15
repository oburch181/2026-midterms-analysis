# The 2026 Ledger — U.S. Midterm Election Shift & Demographic Analysis

**Live Site:** [https://oburch181.github.io/2026-midterms-analysis/](https://oburch181.github.io/2026-midterms-analysis/)

An interactive, open-source data journalism report analyzing all 42 contested November 3, 2026 U.S. Senate and Gubernatorial races against certified 2024 presidential baselines.

## Core Analytical Metrics

Every statewide contest is evaluated across three paired metrics:

1. **Raw Diff. (`2026 Margin − 2024 Margin`)** — Total two-party or coalition margin swing compared to the state's certified 2024 presidential vote.
2. **Mean-Adjusted (`Raw Diff. − National Mean Tide`)** — Subtracts the national average swing (both unweighted state mean and 2026 ballot-weighted mean) to isolate race-level performance beyond the nationwide wave.
3. **Demo-Adjusted (`Raw Diff. − [National Mean Tide + State Demographic CVAP Tilt]`)** — Removes both the national tide and each state's Census Citizen Voting-Age Population (CVAP) demographic tilt, weighted against 2026 national exit-poll group shifts.

## What Is Included

- **Interactive U.S. State Tile Cartogram & Dossier (`Section 01`)**: Toggle between Raw Diff., Mean-Adjusted, Demo-Adjusted, and Unweighted vs. Ballot-Weighted benchmarks, and inspect individual state breakdowns.
- **Candidate Overperformance Chart (`Section 02`)**: Compare every race across all three metrics, sort by Raw Diff., Mean-Adjusted, or Demo-Adjusted, and inspect race-level residuals.
- **Ideological Camps & Policy Pillars (`Section 03`)**: Aggregates results across Pew/CWCP ideological lanes (with hover/expandable member breakdowns and JSON export) and eight verified campaign policy pillars.
- **Demographic Story & Full Ledger (`Section 04`)**: Explains CVAP weighting across key case studies (`TX`, `IA`, `PA`, `WV`), provides a collapsible 42-race table, and exports the full computed dataset as JSON.
- **Executive Summary & Open-Source Audit (`Sections 05–07`)**: Summarizes model convergence (`r = 0.92` between Mean-Adjusted and Demo-Adjusted), resonating policy topics, top overperformers/underperformers, standalone analytical code (`src/analysis/`), and primary source citations.

## Project Structure

- `src/analysis/` — Standalone TypeScript analytical engine (`datasets.ts`, `shiftModel.ts`, `demographicModel.ts`, `types.ts`, `index.ts`) decoupled from UI components for easy auditing, modification, or extension.
- `src/data/` — Statewide race metadata, narrative notes, and primary source citations (`AP`, `Decision Desk HQ`, `Ballotpedia`, `NARA`, `UCSB`, `SSRS`, `UCLA LPPI`, `Brookings`, `The Washington Post`).
- `src/components/` — Interactive cartogram, charts, camp/policy tables, and methodology modal.

## Local Development

```bash
npm install
npm run dev      # Starts Vite dev server at http://localhost:3000
npm run lint     # TypeScript type-checking (tsc --noEmit)
npm run build    # Builds static production bundle into dist/
```

## GitHub Pages Deployment

The repository deploys automatically to GitHub Pages via `.github/workflows/deploy.yml` on pushes to `main`, building with relative `./assets/...` paths (`vite.config.ts`).
