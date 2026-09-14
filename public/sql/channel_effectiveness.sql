-- Does push notification actually move the needle, or just view rate?
-- Note: email_sent is 'Y' for every single row in this extract (checked --
-- 0 rows with email_sent = 'N'), so email's effect can't be isolated here;
-- this only measures push on top of email.
-- push_sent is well-balanced across offer_number, offer_month, and offer
-- quality (checked separately), so this reads as a real channel effect
-- rather than push being targeted at an already-better-converting segment.
SELECT
    push_sent,
    COUNT(*) AS offers,
    COUNT(viewed_offer_date) AS viewed,
    ROUND(100.0 * COUNT(viewed_offer_date) / COUNT(*), 1) AS offer_to_view_pct,
    COUNT(tapped_apply_date) AS applied,
    ROUND(100.0 * COUNT(tapped_apply_date) / NULLIF(COUNT(viewed_offer_date), 0), 1) AS view_to_apply_pct,
    COUNT(loan_date) AS loans,
    ROUND(100.0 * COUNT(loan_date) / COUNT(*), 2) AS offer_to_loan_pct
FROM read_csv_auto('data/funnel.csv')
GROUP BY push_sent
ORDER BY push_sent;
