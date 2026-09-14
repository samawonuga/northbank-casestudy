-- Does the economics of the offer itself predict conversion?
-- Buckets each offer by whether it's a genuine win for the customer
-- (lower monthly payment AND lower total cost), a "smaller bill, bigger
-- total cost" offer (the classic term-extension trade-off), or no monthly
-- saving at all. This ties directly to the survey verbatim "the monthly
-- payment was lower but the total I'd pay back was higher. No thanks."
SELECT
    CASE
        WHEN q.monthly_saving > 0 AND q.total_cost_saving > 0 THEN '1. saves both monthly and total'
        WHEN q.monthly_saving > 0 AND q.total_cost_saving <= 0 THEN '2. lower payment, higher total cost'
        ELSE '3. no monthly saving'
    END AS offer_quality,
    COUNT(*) AS offers,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_offers,
    COUNT(f.tapped_apply_date) AS applied,
    ROUND(100.0 * COUNT(f.tapped_apply_date) / COUNT(*), 2) AS offer_to_apply_pct,
    COUNT(f.loan_date) AS loans,
    ROUND(100.0 * COUNT(f.loan_date) / COUNT(*), 2) AS offer_to_loan_pct
FROM read_csv_auto('data/funnel.csv') f
JOIN read_csv_auto('data/quotes.csv') q
    ON f.application_id = q.application_id
GROUP BY 1
ORDER BY 1;
