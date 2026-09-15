# Northbank Interactive Case Study

This project is an interactive product case study for a fictional refinance product called Northbank. It presents a business narrative around funnel performance, customer value, conversion friction, and the strategic recommendations that would most likely move the product forward.

It is designed as a presentation-style experience rather than as a production app, and it includes a PDF export workflow for sharing the deck in a static format.

## What is in this project

- interactive slide deck with business analysis
- funnel and conversion data visualizations
- customer survey signal summaries
- recommendations and prioritization framework
- export to PDF for presentation use

## Project structure

- `src/main.jsx` — app logic and slide content
- `src/styles.css` — deck styling, layout, and export behavior
- `public/sql/` — SQL used to generate the underlying analysis
- `data/` — CSV inputs used in the case study
- `archive/` — historical exports and prior versions
- `package.json` — project scripts and dependencies

## Local run

From this folder:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## PDF export

The deck includes export logic that captures the current presentation state and generates a PDF. This is intended for sharing the same narrative in a static, presentation-friendly format.

## Important note

This is a fictional business case study. The design, narrative, and data are created for analysis and presentation purposes, not as a live banking product or production system.

## Third-party notices

This project includes reimplemented UI patterns and inspiration from open-source design references. See [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) for the attribution and licensing details.
