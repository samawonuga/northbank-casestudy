export const THEME_LABELS = {
  reach: 'Reach & engagement',
  proposition: 'Proposition & intent',
  conversion: 'Conversion & servicing',
};

export const INITIATIVES = [
  { n: '01', title: 'Expand offer reach', evidence: 'Expand push to more eligible customers and test send timing to increase offer visibility. 52.4% vs 26.0% viewed with vs without push.', quadrant: 'Win quickly', group: 'reach', x: 25, y: 33 },
  { n: '02', title: 'Test repeat-offer cadence and targeting', evidence: 'Test when and how often repeat offers are sent, and tailor the next offer to customer needs such as monthly payment vs total cost. View → Apply falls 31.1% → 6.7% from offer 1 to 4.', quadrant: 'Win quickly', group: 'reach', x: 28, y: 44 },
  { n: '03', title: 'Improve offer value & framing', evidence: 'Review APR/term economics and test tailored value framing, such as monthly payment vs total saving. Only 19.2% of viewers apply; conversion varies materially by APR, term and total-cost saving.', quadrant: 'Win quickly', group: 'proposition', x: 31, y: 40 },
  { n: '04', title: 'Test a minimum total-cost saving threshold', evidence: 'Review offers that lower monthly payments but increase total cost; test whether clearer value framing or pricing changes improve uptake. 38.4% fall into this group.', quadrant: 'Build next', group: 'proposition', x: 70, y: 42 },
  { n: '05', title: 'Simplify digital application experience', evidence: 'Reduce application effort by pre-filling known information and identifying the requirements causing abandonment. 60.8% complete requirements.', quadrant: 'Build next', group: 'conversion', x: 60, y: 46 },
  { n: '06', title: 'Fix settlement verification drop-off', evidence: 'Capture why verification fails, then address the largest causes.', quadrant: 'Build next', group: 'conversion', x: 71, y: 20 },
  { n: '07', title: 'Improve settlement status guidance', evidence: 'Give customers clearer progress, next steps and expectations while settlement is being verified. Survey feedback indicates uncertainty during the settlement wait.', quadrant: 'Keep on radar', group: 'conversion', x: 31, y: 68 },
  { n: '08', title: 'Test trust & reassurance interventions', evidence: 'Audit existing support/trust signals and test targeted in-app (or web) reassurance for hesitant customers (e.g. FAQs or contact options). Survey feedback indicates demand for human reassurance.', quadrant: 'Keep on radar', group: 'conversion', x: 24, y: 76 },
];

export const RATIONALE = [
  {
    name: 'Reach & engagement',
    feel: '“It was one email among many, and nothing followed it up.”',
    assumption: 'Assumes push drives higher conversion, rather than reaching more-engaged customers. Test: randomised push eligibility, send timing and cadence.',
    capability: 'Improve offer delivery — expand push eligibility, test send timing and manage cadence across push, email and in-app.',
  },
  {
    name: 'Proposition & intent',
    feel: '“Lower monthly but a longer term. I’d pay about £600 more in the end.”',
    assumption: 'Assumes offer economics and framing drive low View → Apply, rather than differences in customer intent. Test: tailored value framing and minimum-saving thresholds.',
    capability: 'Review the APR and term offered - set a minimum total-cost saving within risk constraints, and test monthly-payment vs total-saving messaging',
  },
  {
    name: 'Conversion & servicing',
    feel: '“Started the application but it was taking too long so I left it.” · “Waiting on my lender for the settlement figure, it never came.”',
    assumption: 'Assumes completion drop-off is driven by effort and uncertainty, rather than eligibility. Test: pre-fill application details, capture why verification fails, and give customers proactive settlement status updates',
    capability: 'Simplify application & settlement — pre-fill known details, enable save-and-resume, capture verification failure reasons, and provide proactive settlement updates and reassurance.',
  },
];
