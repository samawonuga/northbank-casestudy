-- offer_number lives on quotes.csv, not funnel.csv, hence the join (it's a
-- clean 1:1 on application_id -- 40k rows on both sides, so no fan-out).
-- The base shrinks a lot as offer_number rises (customers who converted or
-- became ineligible drop out of the pool), so percentages matter more than
-- raw counts here -- without them it's easy to mistake "fewer offers reach
-- offer #4" for "offer #4 converts worse", when both are true and need to
-- be seen separately.
SELECT
    offer_number,
    COUNT(*) AS offers,
    COUNT(viewed_offer_date) AS viewed,
    ROUND(100.0 * COUNT(viewed_offer_date) / COUNT(*), 1) AS offer_to_view_pct,
    COUNT(tapped_apply_date) AS applied,
    ROUND(100.0 * COUNT(tapped_apply_date) / NULLIF(COUNT(viewed_offer_date), 0), 1) AS view_to_apply_pct,
    COUNT(loan_date) AS loans,
    ROUND(100.0 * COUNT(loan_date) / COUNT(*), 2) AS offer_to_loan_pct
FROM read_csv_auto('data/funnel.csv') f
JOIN read_csv_auto('data/quotes.csv') q
    ON f.application_id = q.application_id
GROUP BY offer_number
ORDER BY offer_number;