-- Step-to-step conversion, with the raw counts alongside the percentages
-- so a reader isn't left having to cross-reference overall_funnel.sql to
-- see how large each step's base is.
SELECT
    COUNT(*) AS offers,

    COUNT(viewed_offer_date) AS viewed,
    ROUND(100.0 * COUNT(viewed_offer_date) / COUNT(*), 1) AS offer_to_view_pct,

    COUNT(tapped_apply_date) AS applied,
    ROUND(100.0 * COUNT(tapped_apply_date) / NULLIF(COUNT(viewed_offer_date), 0), 1) AS view_to_apply_pct,

    COUNT(completed_requirements_date) AS requirements_complete,
    ROUND(100.0 * COUNT(completed_requirements_date) / NULLIF(COUNT(tapped_apply_date), 0), 1) AS apply_to_requirements_pct,

    COUNT(uploaded_settlement_quote_date) AS quote_uploaded,
    ROUND(100.0 * COUNT(uploaded_settlement_quote_date) / NULLIF(COUNT(completed_requirements_date), 0), 1) AS requirements_to_quote_pct,

    COUNT(completed_settlement_requirement_date) AS settlement_verified,
    ROUND(100.0 * COUNT(completed_settlement_requirement_date) / NULLIF(COUNT(uploaded_settlement_quote_date), 0), 1) AS quote_to_verified_pct,

    COUNT(loan_date) AS loans,
    ROUND(100.0 * COUNT(loan_date) / NULLIF(COUNT(completed_settlement_requirement_date), 0), 1) AS verified_to_loan_pct,

    ROUND(100.0 * COUNT(loan_date) / COUNT(*), 2) AS offer_to_loan_pct

FROM read_csv_auto('data/funnel.csv');