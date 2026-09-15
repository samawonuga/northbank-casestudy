# Northbank refinance case study

An interactive product case study for a Product Manager take-home task. It analyses the performance of Northbank's fictional unsecured-loan refinance product, summarises customer research, and proposes a prioritised next-quarter roadmap.

Northbank is fictional and every dataset in this repository is synthetic. No real customers are represented.

## Scenario

Northbank is a personal-finance app that offers eligible customers the option to refinance an existing personal loan held with another lender. A successful refinance creates a new Northbank loan and uses its proceeds to settle the customer's existing loan, ideally reducing their cost.

Eligible customers receive a new offer each month. The offer compares the proposed Northbank loan with their current loan, including monthly payment, term, and total amount payable. Most customers are notified by email; some also receive a push notification.

When a customer applies, the journey is:

1. Standard requirements: identity and income checks.
2. Settlement quote: the customer uploads a letter from their current lender confirming the amount needed to settle their loan.
3. Settlement verification: Northbank verifies the document and settlement figure.
4. Payout: Northbank settles the old loan and the new loan goes live.

## Questions answered

The case study addresses three questions for Northbank's Managing Director and Head of Product:

1. How is the refinance funnel performing, and which areas are working or need improvement?
2. What are the major survey findings for the product team?
3. Which five to ten initiatives should be prioritised next quarter, and why?

## Data

The data was extracted on 31 August 2026 and covers offers created from March to June 2026, allowing every application in the extract to reach a final outcome. Lender names are anonymised.

- `data/funnel.csv` — refinance applications and their journey stages.
- `data/quotes.csv` — the offer made and the customer's current loan.
- `data/survey.csv` — 31 July 2026 survey responses from customers who did not take up their offer.
- `data/Northbank_Data_Dictionary.pdf` — field definitions.
- `data/Northbank_PM_Task_Brief.pdf` — original take-home brief.

## Project structure

- `src/App.jsx` — application shell, navigation, theme, and PDF download action.
- `src/sections/` — the three case-study sections and appendix.
- `src/content/` — funnel, survey, roadmap, and navigation content.
- `src/ui.jsx` and `src/hooks.js` — shared interface components and behaviour.
- `src/styles.css` — responsive presentation and PDF-export styling.
- `public/sql/` — SQL queries used for the analysis.
- `docs/pdf/northbank.pdf` — downloadable presentation version of the case study.
- `data/` — source datasets and task materials.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Build

```bash
npm run build
```

The app includes a **Download PDF** action that downloads the companion presentation PDF from `docs/pdf/northbank.pdf`. It presents the same findings and prioritisation, in a format tailored for sharing.

## Notes

This is a portfolio case study, not a production banking product. The analysis and recommendations are based on the supplied synthetic data and are designed to demonstrate product thinking, analytical judgement, and communication.

## Third-party notices

See [Third-party notices](docs/THIRD_PARTY_NOTICES.md) for attribution and licensing details.
