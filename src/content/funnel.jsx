import { Evidence } from '../ui.jsx';

export const FUNNEL_LOSSES = [
  { name: 'Offer sent', note: 'Every eligible customer. 45% received a push alongside email.', carry: 100, lost: 0 },
  { name: 'Viewed offer', note: '62% of offers were never opened. The single largest leak.', carry: 37.96, lost: 62.04, lostLabel: '−24,815', stepConv: '38.0%', strong: true },
  { name: 'Tapped apply', note: '80.8% of everyone who viewed the offer never went on to apply.', carry: 7.3, lost: 30.67, lostLabel: '−12,267', stepConv: '19.2%', strong: true },
  { name: 'Requirements done', note: '39% stalled on standard identity and income checks.', carry: 4.44, lost: 2.86, lostLabel: '−1,143', stepConv: '60.8%', dim: true },
  { name: 'Settlement uploaded', note: 'Median 9-day wait for settlement quote.', carry: 3.34, lost: 1.1, lostLabel: '−439', stepConv: '75.3%', dim: true },
  { name: 'Settlement verified', note: '26.8% drop after quote upload; failure reason not captured.', carry: 2.45, lost: 0.9, lostLabel: '−358', stepConv: '73.2%', dim: true },
  { name: 'Loan funded', note: 'The strongest step in the funnel: 92.9% of verified applicants fund.', carry: 2.27, lost: 0.17, lostLabel: '−69', stepConv: '92.9%', strong: true, final: true },
];

export const DOING_WELL = [
  { n: '01', title: 'Push is associated with roughly 2× engagement', detail: 'Push offers have ~2× higher view, apply and loan rates; only 45% include push.' },
  { n: '02', title: 'Verified applicants almost always fund.', detail: '909 of 978 verified applicants are funded. The strongest step in the funnel.' },
  { n: '03', title: 'Month-on-month performance is steady', detail: <>Offer-to-loan holds flat at 2.1–2.6% across four matured cohorts. <Evidence query="funnel_change_over_time.sql">Groups <code>funnel.csv</code> by <code>offer_month</code>; four months in this extract, each carrying 10,000 offers.</Evidence></> },
];

export const OPPORTUNITIES = [
  {
    n: '01', title: 'Reach and engagement', detail: <><strong>Offer reach</strong><br />62% never opened. 24,815 lost; largest observed leak.<br /><br /><strong>Repeat-offer policy</strong><br />View → Apply falls from 31.1% to 6.7% across offers 1–4.</>,
  },
  {
    n: '02', title: 'Proposition & intent', detail: <><strong>Offer value</strong><br />12,267 viewers do not apply; total-cost saving is associated with higher view → apply.</>,
  },
  {
    n: '03', title: 'Conversion and servicing', detail: <><strong>Application completion</strong><br />39% never complete identity and income checks.<br /><br /><strong>Settlement verification</strong><br />358 customers drop after quote upload; root cause requires investigation (e.g. is lender supported?)</>,
  },
];

export const CHANNEL_ROWS = [
  { stage: 'Viewed offer', email: 26.0, push: 52.4, mult: '2.0×' },
  { stage: 'Tapped apply', email: 5.0, push: 10.1, mult: '2.0×' },
  { stage: 'Loan funded', email: 1.6, push: 3.1, mult: '1.9×' },
];

export const APR_QUARTILES = [
  { range: '8.9–12.9%', rate: 29.7 },
  { range: '12.9–16.8%', rate: 22.3 },
  { range: '16.8–20.7%', rate: 15.4 },
  { range: '20.7–32.4%', rate: 9.5 },
];

export const REOFFER = [
  { n: 'Offer 1', apply: 31.1, loan: 4.3 },
  { n: 'Offer 2', apply: 16.8, loan: 2.1 },
  { n: 'Offer 3', apply: 9.7, loan: 1.0 },
  { n: 'Offer 4', apply: 6.7, loan: 0.5 },
];
