-- Raw counts by month happen to be comparable in this extract because each
-- month has exactly 10k offers, but that's incidental to this data pull --
-- add rate columns so the trend still reads correctly if volume varies.
-- push_share is included to flag whether a month-on-month rate change might
-- simply be explained by more/fewer customers getting a push notification
-- that month (see channel_effectiveness.sql for why that matters).
SELECT
    offer_month,
    COUNT(*) AS offers,
    ROUND(100.0 * SUM(CASE WHEN push_sent = 'Y' THEN 1 ELSE 0 END) / COUNT(*), 1) AS push_share_pct,
    COUNT(viewed_offer_date) AS viewed,
    ROUND(100.0 * COUNT(viewed_offer_date) / COUNT(*), 1) AS offer_to_view_pct,
    COUNT(tapped_apply_date) AS applied,
    ROUND(100.0 * COUNT(tapped_apply_date) / NULLIF(COUNT(viewed_offer_date), 0), 1) AS view_to_apply_pct,
    COUNT(completed_requirements_date) AS requirements_complete,
    COUNT(uploaded_settlement_quote_date) AS quote_uploaded,
    COUNT(completed_settlement_requirement_date) AS settlement_verified,
    COUNT(loan_date) AS loans,
    ROUND(100.0 * COUNT(loan_date) / COUNT(*), 2) AS offer_to_loan_pct
FROM read_csv_auto('data/funnel.csv')
GROUP BY offer_month
ORDER BY offer_month;