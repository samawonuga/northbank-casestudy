-- Headline funnel: volumes at each stage, plus how many distinct customers
-- that represents (an "offer" is per-application, and 40k offers go to
-- ~19.9k unique customers because eligible customers reoffer monthly).
SELECT
    COUNT(*) AS offers,
    COUNT(DISTINCT user_id) AS unique_customers,
    COUNT(viewed_offer_date) AS viewed,
    COUNT(tapped_apply_date) AS applied,
    COUNT(completed_requirements_date) AS requirements_complete,
    COUNT(uploaded_settlement_quote_date) AS quote_uploaded,
    COUNT(completed_settlement_requirement_date) AS settlement_verified,
    COUNT(loan_date) AS loans,
    ROUND(100.0 * COUNT(loan_date) / COUNT(*), 2) AS offer_to_loan_pct
FROM read_csv_auto('data/funnel.csv');