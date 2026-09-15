export const TOC_GROUPS = [
  { q: 'Q1', items: [
    { id: 'overview', label: 'Overview' },
    { id: 'funnel', label: 'Where it leaks' },
    { id: 'verdict', label: 'Verdict' },
    { id: 'opportunities', label: 'Opportunities' },
  ] },
  { q: 'Q2', items: [
    { id: 'survey', label: 'Survey' },
  ] },
  { q: 'Q3', items: [
    { id: 'roadmap', label: 'Initiatives' },
    { id: 'rationale', label: 'Why this order' },
  ] },
  { q: null, items: [
    { id: 'appendix', label: 'Method' },
  ] },
];
export const TOC_IDS = TOC_GROUPS.flatMap((g) => g.items.map((s) => s.id));

export const NAV_SECTIONS = [
  { id: 'q1', label: 'Q1 · Funnel', title: 'Question 1 — how the funnel is working, and where to improve it' },
  { id: 'q2', label: 'Q2 · Survey', title: 'Question 2 — major survey findings for the product team' },
  { id: 'q3', label: 'Q3 · Initiatives', title: 'Question 3 — next-quarter initiatives, ranked and justified' },
  { id: 'appendix', label: 'Method', title: 'Caveats, queries and how to read this' },
];
export const NAV_SECTION_IDS = NAV_SECTIONS.map((s) => s.id);

export const AGENDA = [
  { n: 'Q1', title: 'Refinance funnel review', dek: 'Where it converts, where it leaks, and the verdict on both.', href: '#q1' },
  { n: 'Q2', title: 'Customer survey summary', dek: 'Four moments where trust breaks, on one page.', href: '#q2' },
  { n: 'Q3', title: 'Next-quarter initiatives', dek: 'Eight initiatives on impact vs effort, and why in that order.', href: '#q3' },
  { n: '—', title: 'Caveats and method', dek: 'What to trust, what to test, and every query behind it.', href: '#appendix', muted: true },
];
