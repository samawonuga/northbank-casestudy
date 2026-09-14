import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Maximize2, X, Download, Loader2, Sun, Moon, ArrowRight, ArrowUp } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import './styles.css';

/* ============================= slide-deck export ============================= */

const PAGE_W_IN = 13.333;
const PAGE_H_IN = 7.5;
const PX_PER_IN = 96;
const PAGE_W_PX = PAGE_W_IN * PX_PER_IN;
const PAGE_H_PX = PAGE_H_IN * PX_PER_IN;
// Elements a page break should never cut through — mirrors the print stylesheet's break-inside:avoid list.
const AVOID_SPLIT_SELECTOR = '.tilt-card, .verdict-col, .rationale-card, .leak-row, .leak-row-pair, .confirmed-banner, .survey-flow article, .matrix, .cut-grid, .verdict-grid, .rationale-grid, .primary-leak-hero, .executive-leak, .query-inventory, .method-notes, h1, h2, h3, p, blockquote';

// html2canvas's CSS parser can't read the modern color(srgb ...) syntax that
// Chromium serializes color-mix() into (used throughout this stylesheet's tags/
// gradients) — resolve those to plain rgb()/rgba() before capture, on both real
// elements (inline style) and ::before/::after (a scoped stylesheet, since
// pseudo-elements can't take inline styles).
function hexToRgb(hex) {
  const m = hex.trim().match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [3, 5, 4];
}

function resolveExoticColor(value) {
  return value.replace(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g, (_m, r, g, b, a) => {
    const to255 = (v) => Math.round(parseFloat(v) * 255);
    return a !== undefined ? `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${a})` : `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`;
  });
}

function sanitizeExoticColors(root) {
  const styleEl = document.createElement('style');
  document.head.appendChild(styleEl);
  let counter = 0;
  const restoreInline = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i);
      const val = cs.getPropertyValue(prop);
      if (val && val.includes('color(')) {
        restoreInline.push([el, prop, el.style.getPropertyValue(prop)]);
        el.style.setProperty(prop, resolveExoticColor(val), 'important');
      }
    }
    for (const pseudo of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pseudo);
      const decls = [];
      for (let i = 0; i < pcs.length; i++) {
        const prop = pcs.item(i);
        const val = pcs.getPropertyValue(prop);
        if (val && val.includes('color(')) decls.push(`${prop}:${resolveExoticColor(val)} !important;`);
      }
      if (decls.length) {
        const marker = `export-fix-${counter++}`;
        el.setAttribute(`data-${marker}`, '1');
        styleEl.appendChild(document.createTextNode(`[data-${marker}]${pseudo}{${decls.join('')}}`));
      }
    }
  }
  return () => {
    restoreInline.forEach(([el, prop, v]) => { if (v) el.style.setProperty(prop, v); else el.style.removeProperty(prop); });
    styleEl.remove();
  };
}

// A section taller than one page is split at the nearest safe element boundary
// (never through the middle of a card), same idea as CSS break-inside: avoid.
// Cuts target an even share of the remaining height per remaining page, rather
// than always maxing out the current page — a greedy max-then-remainder split
// tends to leave a nearly-blank sliver as the last page of a section, which
// reads as broken rather than as a deliberate second slide.
function computeBreakOffsets(node) {
  const total = node.scrollHeight;
  if (total <= PAGE_H_PX) return [0, total];
  const rect0 = node.getBoundingClientRect();
  const candidates = [...node.querySelectorAll(AVOID_SPLIT_SELECTOR)].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - rect0.top, bottom: r.bottom - rect0.top };
  });
  // When a protected block straddles the intended cut, jumping back to its top
  // is only one option — jumping forward to its bottom (keeping the whole block
  // on the earlier page) is often the better-balanced choice, e.g. a wide
  // sidebar card straddling the halfway point of a section: snapping back
  // strands almost everything on the second page, while snapping forward past
  // it often lands both resulting pages comfortably under budget. Pick
  // whichever safe boundary is closer to the target and still fits its page.
  const snapToSafeBoundary = (cursor, cut) => {
    const hit = candidates.find((c) => cut > c.top + 4 && cut < c.bottom - 4);
    if (!hit) return cut;
    const canBackward = hit.top > cursor + 40;
    const canForward = hit.bottom <= cursor + PAGE_H_PX && hit.bottom > cursor + 40;
    if (canForward && canBackward) return Math.abs(hit.bottom - cut) < Math.abs(cut - hit.top) ? hit.bottom : hit.top;
    if (canForward) return hit.bottom;
    if (canBackward) return hit.top;
    return cut;
  };
  const pageCount = Math.ceil(total / PAGE_H_PX);
  const offsets = [0];
  let cursor = 0;
  for (let i = 1; i < pageCount; i++) {
    const pagesLeft = pageCount - i + 1;
    const target = Math.min(cursor + (total - cursor) / pagesLeft, cursor + PAGE_H_PX);
    offsets.push(snapToSafeBoundary(cursor, target));
    cursor = offsets[offsets.length - 1];
  }
  offsets.push(total);
  // Snapping only ever pulls a cut earlier to dodge a protected element, which can
  // leave whatever's left in a later page longer than one page's budget — re-split
  // any gap that still overflows rather than let that page's content run long. A
  // large protected block (e.g. the impact/effort matrix) can itself eat almost a
  // full page, though, in which case the "remainder" after it is just a sliver —
  // stranding that as its own near-blank page is worse than letting the page
  // before it run slightly over, so it's left alone under MIN_TAIL_PX.
  const MIN_TAIL_PX = 64;
  const fixed = [offsets[0]];
  for (let i = 1; i < offsets.length; i++) {
    let segStart = fixed[fixed.length - 1];
    const segEnd = offsets[i];
    while (segEnd - segStart > PAGE_H_PX) {
      if (segEnd - (segStart + PAGE_H_PX) < MIN_TAIL_PX) break;
      const extra = snapToSafeBoundary(segStart, segStart + PAGE_H_PX);
      if (extra <= segStart) break; // nothing safe to split on further — accept the overflow
      fixed.push(extra);
      segStart = extra;
    }
    fixed.push(segEnd);
  }
  return fixed;
}

const TOC_GROUPS = [
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
const TOC_IDS = TOC_GROUPS.flatMap((g) => g.items.map((s) => s.id));

/* ============================= data ============================= */

const NAV_SECTIONS = [
  { id: 'q1', label: 'Q1 · Funnel', title: 'Question 1 — how the funnel is working, and where to improve it' },
  { id: 'q2', label: 'Q2 · Survey', title: 'Question 2 — major survey findings for the product team' },
  { id: 'q3', label: 'Q3 · Initiatives', title: 'Question 3 — next-quarter initiatives, ranked and justified' },
  { id: 'appendix', label: 'Method', title: 'Caveats, queries and how to read this' },
];
const NAV_SECTION_IDS = NAV_SECTIONS.map((s) => s.id);

const AGENDA = [
  { n: 'Q1', title: 'Refinance funnel review', dek: 'Where it converts, where it leaks, and the verdict on both.', href: '#q1' },
  { n: 'Q2', title: 'Customer survey summary', dek: 'Four moments where trust breaks, on one page.', href: '#q2' },
  { n: 'Q3', title: 'Next-quarter initiatives', dek: 'Eight initiatives on impact vs effort, and why in that order.', href: '#q3' },
  { n: '—', title: 'Caveats and method', dek: 'What to trust, what to test, and every query behind it.', href: '#appendix', muted: true },
];

const FUNNEL_LOSSES = [
  { name: 'Offer sent', note: 'Every eligible customer. 45% received a push alongside email.', carry: 100, lost: 0 },
  { name: 'Viewed offer', note: '62% of offers were never opened — the single largest leak.', carry: 37.96, lost: 62.04, lostLabel: '−24,815', stepConv: '38.0%', strong: true },
  { name: 'Tapped apply', note: '80.8% of everyone who viewed the offer never went on to apply.', carry: 7.3, lost: 30.67, lostLabel: '−12,267', stepConv: '19.2%', strong: true },
  { name: 'Requirements done', note: '39% stalled on standard identity and income checks.', carry: 4.44, lost: 2.86, lostLabel: '−1,143', stepConv: '60.8%', dim: true },
  { name: 'Settlement uploaded', note: 'A median nine-day wait on the customer’s old lender.', carry: 3.34, lost: 1.1, lostLabel: '−439', stepConv: '75.3%', dim: true },
  { name: 'Settlement verified', note: 'Every loss here came from an unsupported lender.', carry: 2.45, lost: 0.9, lostLabel: '−358', stepConv: '73.2%', dim: true },
  { name: 'Loan funded', note: 'The strongest step in the funnel: 92.9% of verified applicants fund.', carry: 2.27, lost: 0.17, lostLabel: '−69', stepConv: '92.9%', strong: true, final: true },
];

const DOING_WELL = [
  { n: '01', title: 'Push is associated with roughly 2× engagement', detail: '~2× lift in view, apply and loan rate at every stage — but only 45% of offers carry one.' },
  { n: '02', title: 'Past verification, the back half converts', detail: '909 of 978 verified applicants are funded. The strongest step in the funnel.' },
  { n: '03', title: 'Month-on-month performance is steady', detail: 'Offer-to-loan holds flat at 2.1–2.6% across four matured cohorts.' },
];

const OPPORTUNITIES = [
  { n: '01', title: 'Offer reach', detail: '62% never opened. 24,815 lost — the largest observed leak.' },
  { n: '02', title: 'Offer value', detail: '12,267 viewers do not apply; total-cost saving is associated with higher view → apply.' },
  { n: '03', title: 'Settlement verification', detail: '0% of 358 applicants from unsupported lenders verify.', confirmed: true },
  { n: '04', title: 'Application completion', detail: '39% never complete identity and income checks.' },
  { n: '05', title: 'Repeat-offer policy', detail: 'Apply rate halves at every repeat offer — 13.6% down to 2.0%.' },
];

const CHANNEL_ROWS = [
  { stage: 'Viewed offer', email: 26.0, push: 52.4, mult: '2.0×' },
  { stage: 'Tapped apply', email: 5.0, push: 10.1, mult: '2.0×' },
  { stage: 'Loan funded', email: 1.6, push: 3.1, mult: '1.9×' },
];

const APR_QUARTILES = [
  { range: '8.9–12.9%', rate: 29.7 },
  { range: '12.9–16.8%', rate: 22.3 },
  { range: '16.8–20.7%', rate: 15.4 },
  { range: '20.7–32.4%', rate: 9.5 },
];

const REOFFER = [
  { n: 'Offer 1', apply: 13.6, loan: 4.3 },
  { n: 'Offer 2', apply: 6.5, loan: 2.1 },
  { n: 'Offer 3', apply: 3.4, loan: 1.0 },
  { n: 'Offer 4', apply: 2.0, loan: 0.5 },
];

const SURVEY = [
  { n: '01', pct: '15%', stage: 'Weighing it up', mode: 'Value-sensitive', insight: 'A lower payment does not read as value when total repayment rises.', quote: '“Lower monthly but a longer term. I worked out I’d pay about £600 more in the end.”' },
  { n: '02', pct: '~7%', stage: 'Deciding to commit', mode: 'Reassurance-seeking', insight: 'Some customers want human reassurance before moving a meaningful balance.', quote: '“It’s a big decision; I wanted a human not an app.”' },
  { n: '03', pct: '16%', stage: 'Getting it done', mode: 'Time-constrained', insight: 'The self-serve journey is too hard to finish in one sitting.', quote: '“Started the application but it was taking too long so I left it.”' },
  { n: '04', pct: '15%', stage: 'Handing off control', mode: 'Lender-constrained', insight: 'An external dependency feels like abandonment without status or support.', quote: '“Waiting on my lender for the settlement figure, it never came.”' },
];

const THEME_LABELS = {
  platform: 'Platform',
  proposition: 'Offer value',
  growth: 'Offer reach',
  experience: 'Application completion',
  service: 'Assisted support',
};

const INITIATIVES = [
  { n: '01', title: 'Extend settlement verification coverage', evidence: 'Confirmed failure state · close in parallel with upstream conversion work', feedback: '“I had no idea what a settlement letter was or where to get one.”', quadrant: 'Plan', group: 'platform', x: 71, y: 20 },
  { n: '02', title: 'Set a minimum value floor', evidence: 'Funnel + survey · improve value alongside offer-reach work', feedback: '“Lower monthly but a longer term” does not feel like a saving.', quadrant: 'Plan', group: 'proposition', x: 70, y: 42 },
  { n: '03', title: 'Expand push eligibility, test new channels', evidence: 'Funnel · largest volume opportunity', quadrant: 'Do now', group: 'growth', x: 25, y: 33 },
  { n: '04', title: 'Simplify and pre-fill the application', evidence: 'Funnel + survey · largest in-app drop', feedback: '“Started the application but it was taking too long so I left it.”', quadrant: 'Plan', group: 'experience', x: 64, y: 57 },
  { n: '05', title: 'Support during the settlement wait', evidence: 'Funnel + survey · low build cost', feedback: 'Customers describe waiting on the old lender as being left without a next step.', quadrant: 'Do now', group: 'experience', x: 31, y: 68 },
  { n: '06', title: 'Pilot an assisted / callback option', evidence: 'Survey only · contained pilot', feedback: '“It’s a big decision; I wanted a human, not an app.”', quadrant: 'Fill-in', group: 'service', x: 24, y: 76 },
  { n: '07', title: 'Manage re-offer frequency', evidence: 'Funnel · reduce repeat contact before scaling reach', feedback: 'For some, the offer arrives too late: “I’m almost done paying it off.”', quadrant: 'Do now', group: 'growth', x: 28, y: 49 },
  { n: '08', title: 'Test offer design by cohort', evidence: 'Funnel + survey · experiment with APR, term and value framing across customer segments', feedback: '“Lower monthly but a longer term” does not feel like a saving.', quadrant: 'Plan', group: 'proposition', x: 76, y: 64 },
];

const RATIONALE = [
  {
    name: 'Verification coverage', confirmed: true,
    feel: 'Stranded waiting on a figure from the old lender.',
    data: '0% of 358 applicants from unsupported lenders ever verify.',
    assumption: 'Confirmed, not assumed — named-lender count equals verified count every month. Nothing to test.',
    capability: 'Document parsing — wider lender coverage behind a manual-review queue.',
  },
  {
    name: 'Offer reach',
    feel: 'One email among many, with no second touchpoint.',
    data: '62% never open. Push doubles engagement but reaches 45% of offers.',
    assumption: 'Assumes the push lift is causal, not a proxy for app-engaged customers. Test: randomised push-eligibility A/B.',
    capability: 'Channel orchestration — push, SMS and in-app, with frequency control.',
  },
  {
    name: 'Offer value',
    feel: 'A lower monthly payment can feel like a saving even when the total cost is higher.',
    data: 'View-to-apply 27.8% with a saving, 5.3% without. 38.4% of offers raise total cost.',
    assumption: 'Assumes customers respond to monthly affordability as much as total cost. Test: A/B minimum-saving thresholds and clearer value framing.',
    capability: 'Offer eligibility engine — saving thresholds, term caps and value framing tuned by cohort, not just display copy.',
  },
  {
    name: 'Application completion',
    feel: 'Too long to finish in one sitting, so they leave it.',
    data: '39% never complete ID and income checks. Median 9-day settlement wait.',
    assumption: 'Assumes drop-off is effort, not eligibility. Test: pre-filled versus current requirements flow.',
    capability: 'Save-and-resume — prefilled data, status visibility, assisted route.',
  },
];

const CAVEATS = [
  'Every offer in this extract was emailed, so email’s own effect can’t be isolated — only push’s incremental lift on top of it is measurable here.',
  'APR, saving and push comparisons are correlational, not a designed experiment — consistent and monotonic enough to act on, but A/B tests would confirm causality before a full rollout.',
  'Opportunity 01 is the exception: causally confirmed, not inferred — the named-lender count matches the verified count exactly, every month. Extending coverage is a platform decision, not a product lever.',
];

const QUERY_INVENTORY = [
  ['Data setup & integrity', 2],
  ['Core funnel', 2],
  ['Offer reach', 5],
  ['Offer value', 5],
  ['Application completion', 2],
  ['Lender-verification investigation', 6],
  ['Business impact', 1],
  ['Survey theme coding', 2],
];

/* ============================= small building blocks ============================= */

function Split({ children }) {
  let i = 0;
  const words = children.split(' ');
  return (
    <span className="split" aria-label={children}>
      {words.map((word, w) => (
        <span className="word" key={word + w}>
          {[...word].map((ch) => <i aria-hidden="true" key={i} style={{ '--i': i++ }}>{ch}</i>)}
        </span>
      )).reduce((acc, el, idx) => idx === 0 ? [el] : [...acc, ' ', el], [])}
    </span>
  );
}

function Eyebrow({ index, children }) {
  return (
    <div className="eyebrow">
      {index && <span>{index}</span>}
      {children}
    </div>
  );
}

function SectionHead({ eyebrow, title, dek, split }) {
  return (
    <div className={`slide-head${split ? ' split-head' : ''}`}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2>{title}</h2>
      </div>
      {dek && <p className="slide-dek">{dek}</p>}
    </div>
  );
}

function Tilt({ children, className = '' }) {
  return <article className={`tilt-card ${className}`}>{children}</article>;
}

function QuestionDivider({ n, children, note }) {
  return (
    <section className="question">
      <Reveal>
        <div className="q-line"><i /></div>
        <span className="q-eyebrow">Question {n} of 3</span>
        <h2>{children}</h2>
        {note && <p className="q-note">{note}</p>}
      </Reveal>
    </section>
  );
}

function Reveal({ children, as: Tag = 'div', className = '', delay = 0 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.unobserve(el); } },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal${inView ? ' in' : ''}${className ? ` ${className}` : ''}`} style={{ '--delay': `${delay}ms` }}>
      {children}
    </Tag>
  );
}

function TocRail() {
  const active = useActiveSection(TOC_IDS);
  return (
    <nav className="toc-rail" aria-label="Jump to section">
      {TOC_GROUPS.map((group) => (
        <div className="toc-group" key={group.q || 'method'}>
          {group.q && <span className="toc-group-label">{group.q}</span>}
          {group.items.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'active' : ''}>
              <i />
              <span>{s.label}</span>
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Modal({ eyebrow, title, tag, onClose, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="cut-no">{eyebrow}</span>
          <div className="cut-top-actions">
            {tag}
            <button ref={closeRef} className="expand-btn" onClick={onClose} aria-label="Close expanded view">
              <X size={16} />
            </button>
          </div>
        </div>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ConfidenceTag({ confirmed }) {
  return confirmed
    ? <span className="tag">Confirmed</span>
    : <span className="correlational-tag">Correlational</span>;
}

function Evidence({ query, queryFile, method, children }) {
  const [open, setOpen] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [sql, setSql] = useState('');
  const label = query ? `Evidence from ${query}` : `Method: ${method}`;
  const file = queryFile || (query?.endsWith('.sql') ? query : null);
  const revealQuery = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setShowQuery(!showQuery);
    if (!sql && file) {
      try {
        const queryUrl = `${import.meta.env.BASE_URL}sql/${file}`;
        setSql(await fetch(queryUrl).then((response) => response.ok ? response.text() : Promise.reject()));
      }
      catch { setSql('-- Query file could not be loaded.'); }
    }
  };
  return (
    <span className={`evidence-tip${open ? ' open' : ''}`}>
      <button type="button" onClick={(event) => { event.preventDefault(); setOpen(!open); }} aria-label={label} aria-expanded={open}>{query ? 'SQL' : 'Method'}</button>
      <span role="tooltip"><button className="close-tooltip" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); setShowQuery(false); }} aria-label="Close evidence tooltip">×</button><b>{query ? `Query · ${query}` : `Method · ${method}`}</b>{children}{file && <button className="see-query" type="button" onClick={revealQuery} aria-expanded={showQuery}>{showQuery ? 'Hide query' : 'See query'}</button>}{showQuery && <pre>{sql || 'Loading query…'}</pre>}</span>
    </span>
  );
}

function Loader({ done, onDone }) {
  const cells = Array.from({ length: 100 });
  return (
    <div className={`loader${done ? ' done' : ''}`} aria-hidden={done}>
      <button type="button" onClick={onDone}>Skip intro</button>
      <div className="loader-mark" aria-hidden="true">
        {cells.map((_, i) => <i key={i} style={{ '--x': i % 10, '--y': Math.floor(i / 10) }} />)}
      </div>
      <p><span>Northbank</span> · case study</p>
      <small>Loading the evidence</small>
    </div>
  );
}

/* ============================= hooks ============================= */

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? h.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
}

function useActiveSection(ids) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/* ============================= Q1 sections ============================= */

function Overview() {
  return (
    <section className="slide" id="overview">
      <SectionHead
        eyebrow="Q1 · Funnel review"
        title="The funnel works after people engage. Most of the drop-off happens before they even open the offer."
        dek="2.3% of offers become loans. The main bottlenecks are reach, value and completion."
      />
      <p className="provenance-note">Every <span>SQL</span>-tagged figure links to its source query — see <a href="#appendix">Method</a>.</p>
      <Reveal>
      <div className="metric-row">
        <Tilt>
          <small>Offer → loan</small>
          <b>2.3% <Evidence query="overall_funnel.sql">Counts funded <code>loan_date</code> values over all 40,000 offers in <code>funnel.csv</code>.</Evidence></b>
          <p>909 loans from 40,000 offers.</p>
        </Tilt>
        <Tilt>
          <small>Never opened</small>
          <b>62% <Evidence query="conversion_by_stage.sql">Counts non-null <code>viewed_offer_date</code> values; the complement is offers never viewed.</Evidence></b>
          <p>24,815 offers never viewed — the largest leak.</p>
        </Tilt>
        <Tilt>
          <small>Push effect</small>
          <b>~2× <Evidence query="channel_effectiveness.sql">Groups the funnel by <code>push_sent</code>. All offers were emailed, so it measures push on top of email, not email’s standalone effect.</Evidence></b>
          <p>Digital engagement lift at every stage, on top of email.</p>
        </Tilt>
      </div>
      <div className="business-line">
        <b>£8.6M<small>New loan balances written</small></b>
        <b>£1.08M<small>Total-cost savings passed to customers</small></b>
        <b>14.7%<small>Average APR on funded loans, avg. balance £9,509</small></b>
      </div>
      </Reveal>
    </section>
  );
}

function LeakRow({ s, i }) {
  return (
    <Reveal as="div" className={`leak-row${i === 1 ? ' big-drop drop-start' : ''}${i === 2 ? ' big-drop drop-end' : ''}`} delay={i * 55}>
      <div className={`leak-name${s.strong ? ' strong' : ''}${s.dim ? ' dim' : ''}`}>
        <strong>{s.name}</strong>
        <small>{s.note}</small>
        {i === 1 && <span className="drop-badge">Largest drop zone</span>}
      </div>
      <div className="leak-bar">
        <i className={s.final ? 'carry final' : 'carry'} style={{ '--w': `${s.carry}%` }} />
        {s.lost > 0 && <i className="lost" style={{ '--w': `${s.lost}%` }} />}
      </div>
      <div className="leak-lost">{s.lostLabel || '—'}</div>
      <div className={s.final ? 'leak-conv good' : 'leak-conv'}>{s.stepConv || '—'}</div>
    </Reveal>
  );
}

function FunnelLeakTable() {
  return (
    <section className="slide flow-slide" id="funnel">
      <SectionHead
        eyebrow="Q1 · Where offers are lost"
        title="Two decisions explain most of the drop-off."
        dek={<>40,000 offers, 909 loans. Each row shows what carried forward, what was lost and how each step converted. <Evidence query="overall_funnel.sql + conversion_by_stage.sql" queryFile="conversion_by_stage.sql">The headline query counts every dated funnel event; the stage query divides each event count by the prior completed stage.</Evidence></>}
        split
      />
      <div className="leak-legend">
        <span><i className="sw carry" />Carried forward</span>
        <span><i className="sw lost" />Lost at this step</span>
      </div>
      <div className="leak-table">
        <div className="leak-head">
          <span>Stage</span>
          <span>Share of all 40,000 offers</span>
          <span>Lost here</span>
          <span>Step conv.</span>
        </div>
        <LeakRow s={FUNNEL_LOSSES[0]} i={0} />
        {/* Viewed offer + Tapped apply render as one bordered "biggest drop" callout
           (see .big-drop/.drop-start/.drop-end below) — wrapped together so a PDF/print
           page break can't land between them and cut the callout in half. */}
        <div className="leak-row-pair">
          <LeakRow s={FUNNEL_LOSSES[1]} i={1} />
          <LeakRow s={FUNNEL_LOSSES[2]} i={2} />
        </div>
        {FUNNEL_LOSSES.slice(3).map((s, idx) => <LeakRow s={s} i={idx + 3} key={s.name} />)}
      </div>
      <p className="flow-hint">Everything from requirements onward converts at 60–93%. The largest losses occur in the <span className="marker-sweep">first two customer decisions</span>: opening the offer and choosing to apply.</p>
    </section>
  );
}

function Verdict() {
  return (
    <section className="slide" id="verdict">
      <SectionHead
        eyebrow="Q1 · Verdict"
        title="Most of the loss happens before the application."
        dek="Offer reach is the largest observed leak. Offer value is the next biggest issue. Settlement verification is a confirmed hard stop for a smaller group."
      />
      <div className="verdict-grid">
        <Reveal className="verdict-col good">
          <div className="verdict-col-head">
            <h3>Doing well</h3>
            <span>Protect these</span>
          </div>
          {DOING_WELL.map((d) => (
            <div className="verdict-item" key={d.n}>
              <b>{d.n}</b>
              <div>
                <h4>{d.title}</h4>
                <p>{d.detail}</p>
              </div>
            </div>
          ))}
        </Reveal>
        <Reveal className="verdict-col watch" delay={100}>
          <div className="verdict-col-head">
            <h3>Could be improved</h3>
            <span>5 areas to address</span>
          </div>
          {OPPORTUNITIES.map((o) => (
            <div className="verdict-item" key={o.n}>
              <b>{o.n}</b>
              <div>
                <h4>{o.title}{o.confirmed && <span className="confirmed-tag">Confirmed</span>}</h4>
                <p>{o.detail}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function ReachBody({ compact }) {
  return (
    <>
      <div className="loss-stack">
        <i style={{ '--v': '63.5%' }} />
        <i style={{ '--v': '31.4%' }} />
        <i style={{ '--v': '5.1%' }} />
      </div>
      <p className="chart-caption">Share of offers lost at each stage before funding.</p>
      <div className="loss-breakdown">
        <div><i className="swatch" style={{ opacity: 1 }} /><div><b>63.5%</b><small>never opened{!compact && ' · 24,815'}</small></div></div>
        <div><i className="swatch" style={{ opacity: .6 }} /><div><b>31.4%</b><small>no apply{!compact && ' · 12,267'}</small></div></div>
        <div><i className="swatch" style={{ opacity: .3 }} /><div><b>5.1%</b><small>in application{!compact && ' · 2,009'}</small></div></div>
      </div>
      {!compact && (
        <div className="channel-compare">
          {CHANNEL_ROWS.map((r) => (
            <div className="row" key={r.stage}>
              <span>{r.stage}</span>
              <div className="bars">
                <i style={{ '--w': `${r.email}%` }}><em /></i>
                <i className="on" style={{ '--w': `${r.push}%` }}><em /></i>
              </div>
              <span className="mult">{r.mult}</span>
            </div>
          ))}
        </div>
      )}
      <p className="body-note">Push roughly doubles conversion, but reaches only 45% of offers. <Evidence query="channel_effectiveness.sql">Counts viewed, applied and funded offers by <code>push_sent</code>; results are observational, not a randomised test.</Evidence></p>
    </>
  );
}

function PropositionBody() {
  return (
    <>
      <div className="apr-chart">
        {APR_QUARTILES.map((q, i) => (
          <div key={q.range}>
            <i style={{ '--h': `${(q.rate / 29.7) * 100}%` }}>{q.rate}%</i>
            <span>{i === 0 ? 'Q1 · low' : i === 3 ? 'Q4 · high' : `Q${i + 1}`}</span>
          </div>
        ))}
      </div>
      <p className="chart-caption">View → apply rate by offer APR quartile, low to high.</p>
      <div className="compare">
        <div><b>27.8%</b><small>view → apply, with a total-cost saving</small></div>
        <div><b className="neg">5.3%</b><small>view → apply, without one</small></div>
      </div>
      <p className="body-note">Many offers cut the monthly payment without cutting total cost — a saving that isn’t a saving. Customers are responding to what feels affordable now, not just to the lowest total repayment. <Evidence query="offer_quality_vs_conversion.sql">Joins offer economics from <code>quotes.csv</code>, then compares application and loan rates across saving-quality buckets.</Evidence></p>
    </>
  );
}

function ExperienceBody() {
  return (
    <>
      <div className="evidence-group">
        <span>Repeat-offer policy</span>
        <div className="reoffer-chart">
          {REOFFER.map((r) => (
            <div className="row" key={r.n}>
              <span>{r.n}</span>
              <div className="bar"><i style={{ '--w': `${(r.apply / 13.6) * 100}%` }} /></div>
              <b>{r.apply}% / {r.loan}%</b>
            </div>
          ))}
        </div>
        <p className="chart-caption">Apply % / loan % by re-offer attempt.</p>
      </div>
      <div className="evidence-group completion-group">
        <span>Application completion</span>
        <div className="stat-pair">
          <div><b>39%</b><small>never complete ID &amp; income checks</small></div>
          <div><b>9 days</b><small>median wait on the old lender</small></div>
        </div>
      </div>
      <p className="drift-note">Repeat offers get worse: total-cost saving falls £400 → £223 while the monthly figure <em>rises</em> £62 → £90. <Evidence query="repeat_exposure.sql">Groups a clean 1:1 funnel/quotes join by <code>offer_number</code>; percentages prevent a shrinking repeat-offer base from being mistaken for conversion decay.</Evidence></p>
    </>
  );
}

function SettlementBody() {
  return (
    <>
      <div className="stat-pair">
        <div><b>358</b><small>applicants from unsupported lenders reached settlement upload</small></div>
        <div><b>0%</b><small>of this cohort completed verification</small></div>
      </div>
      <p className="body-note">Named-lender count equals verified count every month: every observed loss at this point comes from an unsupported lender. <Evidence method="lender-verification investigation">The analysis joins <code>funnel.csv</code> and <code>quotes.csv</code> 1:1, checks named lender against verification by month, then isolates uploaded settlement documents.</Evidence></p>
    </>
  );
}

const OPPORTUNITY_CARDS = {
  reach: { eyebrow: '02 · Offer reach', title: '62% of offers are never opened.', Body: ReachBody },
  value: { eyebrow: '03 · Offer value', title: 'A saving that isn’t a saving doesn’t convert.', Body: PropositionBody },
  friction: { eyebrow: '04–05 · Completion & repeat offers', title: 'Application completion and repeat-offer quality.', Body: ExperienceBody },
  settlement: { eyebrow: '03 · Settlement verification', title: 'Settlement verification hard stop.', Body: SettlementBody, confirmed: true },
};

function OpportunityCuts() {
  const [expanded, setExpanded] = useState(null);
  const active = expanded ? OPPORTUNITY_CARDS[expanded] : null;

  return (
    <section className="slide executive-opportunities" id="opportunities">
      <SectionHead
        eyebrow="Q1 · Opportunities"
        title="Most conversion is lost before people apply."
        dek="Reach is the biggest leak. Verification is a confirmed blocker for a smaller cohort."
      />
      <div className="opportunity-frame">
        <Reveal className="primary-leak-hero">
          <div className="opportunity-kicker"><span>Primary conversion leak</span><span>Observed funnel pattern</span></div>
          <h3>Offer engagement</h3>
          <div className="verification-stat"><b>24,815</b><span>offers are never opened</span></div>
          <div className="verification-proof"><b>62%</b><span>of all offers are lost before the proposition is seen</span></div>
          <div className="primary-loss-visual" aria-label="63.5% of all losses are offers never opened, 31.4% are opened but not applied for, and 5.1% occur in the application"><i /><i /><i /></div>
          <p><strong>Conversion is lost before customers assess value or begin an application.</strong> Push is associated with roughly 2× engagement, but reaches only 45% of offers.</p>
        </Reveal>

        <div className="secondary-leaks">
          <div className="opportunity-kicker"><span>Secondary conversion leaks</span><span>Correlational signals + one confirmed hard stop</span></div>
          <Reveal className="executive-leak" delay={0}>
            <div>
              <div className="exec-card-kicker"><span>02 · Offer value</span><button className="expand-btn" onClick={() => setExpanded('value')} aria-label="Expand offer value analysis"><Maximize2 size={14} /></button></div>
              <h3>80.8% <em>of viewers do not apply</em></h3>
              <p>12,267 customers. View → apply is higher when offers have a total-cost saving.</p>
            </div>
            <div className="exec-visual value-visual" aria-label="View to apply rate by APR quartile: 29.7%, 22.3%, 15.4%, and 9.5% from lowest to highest APR"><i><b>29.7</b></i><i><b>22.3</b></i><i><b>15.4</b></i><i><b>9.5</b></i></div>
          </Reveal>
          <Reveal className="executive-leak" delay={80}>
            <div>
              <div className="exec-card-kicker"><span>03 · Settlement verification</span><div className="exec-card-actions"><ConfidenceTag confirmed /><button className="expand-btn" onClick={() => setExpanded('settlement')} aria-label="Expand settlement verification analysis"><Maximize2 size={14} /></button></div></div>
              <h3>358 <em>applicants reach a hard stop</em></h3>
              <p>0% verify when their lender is unsupported — confirmed for this smaller cohort.</p>
            </div>
            <div className="exec-visual verification-visual" aria-label="0% of applicants from unsupported lenders are verified"><i /><b>0%</b></div>
          </Reveal>
          <Reveal className="executive-leak" delay={160}>
            <div>
              <div className="exec-card-kicker"><span>04–05 · Application &amp; repeat offers</span><button className="expand-btn" onClick={() => setExpanded('friction')} aria-label="Expand application and repeat-offer analysis"><Maximize2 size={14} /></button></div>
              <h3>39% <em>stall on requirements</em></h3>
              <p>Median lender wait is nine days; apply rate falls from 13.6% to 2.0% across repeat offers.</p>
            </div>
            <div className="exec-visual momentum-visual" aria-label="Apply rate drops from 13.6% on the first offer to 2.0% on the fourth"><i><b>13.6</b></i><i><b>6.5</b></i><i><b>3.4</b></i><i><b>2.0</b></i></div>
          </Reveal>
        </div>
      </div>
      <div className="executive-takeaway"><span>Takeaway</span><p>Fix reach and value first. Close the verification gap in parallel.</p></div>
      <p className="opportunity-source">Evidence: funnel events, lender-verification investigation, channel effectiveness, offer economics and repeat-offer analysis. <a href="#appendix">See method and queries</a>.</p>
      {active && (
        <Modal eyebrow={active.eyebrow} title={active.title} tag={active.confirmed ? <ConfidenceTag confirmed /> : <ConfidenceTag />} onClose={() => setExpanded(null)}>
          <active.Body />
        </Modal>
      )}
    </section>
  );
}

/* ============================= Q2 ============================= */

function Survey() {
  return (
    <section className="slide survey-slide" id="survey">
      <SectionHead
        eyebrow="Q2 · Survey findings"
        title="Customers aren’t rejecting refinancing. They’re rejecting the experience."
        dek="Four moments in one decision journey: the same three issues show up in both the funnel and the survey."
      />
      <div className="survey-flow">
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
          <path d="M55 142 C180 38 270 195 380 110 S590 30 650 130 S820 200 940 82" />
        </svg>
        {SURVEY.map((c, i) => (
          <Reveal as="article" delay={i * 90} key={c.n}>
            <span>{c.n}</span>
            <b>{c.pct}</b>
            <h3>{c.stage}</h3>
            <span className="survey-mode">{c.mode}</span>
            <p className="survey-insight">{c.insight}</p>
            <blockquote>{c.quote}</blockquote>
            <i />
          </Reveal>
        ))}
      </div>
      <div className="survey-synthesis"><b>The synthesis</b><p>These are four needs, not one “non-converter” group: clearer value, reassurance, less effort, and help with an external lender. Customers are weighing monthly payment and term length as much as total cost.</p></div>
      <p className="survey-foot">300 comments coded by theme. Customer modes can overlap; read alongside the funnel evidence. <Evidence method="two-pass survey theme coding">300 free-text responses were coded separately by <code>user_id</code>; themes can overlap and are not SQL-derived percentages.</Evidence></p>
    </section>
  );
}

/* ============================= Q3 ============================= */

function Matrix() {
  const [activeId, setActiveId] = useState('03');
  return (
    <section className="slide matrix-slide" id="roadmap">
      <SectionHead
        eyebrow="Q3 · Next-quarter initiatives"
        title="Eight recommendations, prioritised by impact, effort and evidence."
        dek="Priority order: fix reach first, then value, then completion. Verification should run in parallel because it is a confirmed blocker for a smaller cohort."
      />
      <Reveal className="matrix-layout">
        <p className="matrix-summary">We should start with the problems that create the most lost volume: reach, then value, then completion. Verification is a hard-stop fix that should run in parallel.</p>
        <div className="matrix">
          <div className="axis y">Impact on conversion <span>high</span></div>
          <div className="axis x">Effort and build cost <span>high</span></div>
          <div className="quadrant q1">Plan &amp; resource</div>
          <div className="quadrant q2">Do now</div>
          <div className="quadrant q3">Fill-in</div>
          <div className="quadrant q4">Reconsider</div>
          {INITIATIVES.map((it, i) => (
            <button
              key={it.n}
              className={`initiative ${it.group}${it.n === activeId ? ' active' : ''}`}
              style={{ '--x': `${it.x}%`, '--y': `${it.y}%`, '--i': i }}
              onClick={() => setActiveId(it.n)}
              onFocus={() => setActiveId(it.n)}
              aria-label={`${it.n} ${it.title}`}
            >
              {it.n}
            </button>
          ))}
        </div>
        <div className="matrix-list">
          {INITIATIVES.map((it) => {
            const isActive = it.n === activeId;
            return (
              <button
                key={it.n}
                className={isActive ? 'active' : ''}
                onClick={() => setActiveId(isActive ? null : it.n)}
              >
                <div className="row-head">
                  <b>{it.n}</b>
                  <span>{it.title}</span>
                  <small className={`theme-chip ${it.group}`}>{THEME_LABELS[it.group]}</small>
                  <small>{it.quadrant}</small>
                </div>
                {isActive && <div className="initiative-detail"><p>{it.evidence}</p>{it.feedback && <p className="initiative-feedback"><b>Customer signal</b>{it.feedback}</p>}</div>}
              </button>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

function Rationale() {
  return (
    <section className="slide rationale" id="rationale">
      <SectionHead
        eyebrow="Q3 · Why this order"
        title="Read from top to bottom."
        dek="Each opportunity is laid out in one place: what customers said, what the data shows, what we’re assuming, and what we’d build."
      />
      <div className="rationale-grid">
        {RATIONALE.map((r, i) => (
          <Reveal as="div" delay={i * 90} className={`rationale-card${r.confirmed ? ' confirmed' : ''}`} key={r.name}>
            <div className="rationale-card-head">
              <h3>{r.name}</h3>
              <ConfidenceTag confirmed={r.confirmed} />
            </div>
            <div className="rationale-row">
              <span>Customers feel</span>
              <p>{r.feel}</p>
            </div>
            <div className="rationale-row">
              <span>Data shows</span>
              <p>{r.data}</p>
            </div>
            <div className="rationale-row">
              <span>We’re assuming</span>
              <p>{r.assumption}</p>
            </div>
            <div className="rationale-row">
              <span>We’d build</span>
              <p>{r.capability}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================= appendix + shell ============================= */

function Appendix() {
  return (
    <section className="slide appendix" id="appendix">
      <SectionHead
        eyebrow="Appendix"
        title="How to read this, and where the analysis came from."
      />
      <Reveal className="appendix-reading">
        <ul className="caveats">
          {CAVEATS.map((c, i) => (
            <li key={i}><b>{`Caveat ${i + 1}`}</b><span>{c}</span></li>
          ))}
        </ul>
        <p className="appendix-note">Deliberately not published: estimating each customer’s current APR from balance, payment and term. Not cleanly comparable with the fields available, so it was dropped rather than forced.</p>
      </Reveal>
      <Reveal className="query-inventory">
        <aside>
          <span className="query-total">25</span>
          <span className="query-total-label">Queries · 2 coding passes</span>
          <ul className="query-list">
            {QUERY_INVENTORY.map(([label, n]) => (
              <li key={label}><span>{label}</span><b>{n}</b></li>
            ))}
          </ul>
          <p className="appendix-source">funnel.csv, quotes.csv and survey.csv joined 1:1 on application_id. Run in DuckDB.</p>
        </aside>
      </Reveal>
      <Reveal className="appendix-provenance">
        <div className="method-notes" aria-label="Working notes">
          <span>Working notes · first pass</span>
          <article>
            <b>01 · Start with the shape of the data</b>
            <p>Checked the CSV grain, date coverage and 1:1 <code>application_id</code> join before drawing conclusions.</p>
          </article>
          <article>
            <b>02 · Where does the funnel actually break?</b>
            <p>Counted each dated event, then compared losses by volume and step conversion. The first two customer decisions dominate.</p>
          </article>
          <article>
            <b>03 · Is this offer reach, offer value or application completion?</b>
            <p>Split the funnel by <code>push_sent</code>, offer economics and repeat exposure; joined survey comments to explain the pattern, not prove it.</p>
          </article>
          <article>
            <b>04 · What should happen first?</b>
            <p>Separated the confirmed verification constraint from hypotheses to test, then ranked work by customer impact, effort and dependency.</p>
          </article>
        </div>
        <div className="method-map" aria-label="Query map">
          <span>Query map</span>
          <p><code>overall_funnel.sql</code> — headline volumes and offer-to-loan rate.</p>
          <p><code>conversion_by_stage.sql</code> — step conversion and stage loss.</p>
          <p><code>channel_effectiveness.sql</code> — push versus email-only comparison.</p>
          <p><code>offer_quality_vs_conversion.sql</code> — offer economics and conversion.</p>
          <p><code>repeat_exposure.sql</code> — repeat offer performance.</p>
          <p><code>funnel_change_over_time.sql</code> — month-on-month stability.</p>
        </div>
        <div className="tools-used" aria-label="Tools used">
          <span>Tools used</span>
          <div><b>Analysis</b><p>DuckDB · SQL</p></div>
          <div><b>Presentation</b><p>PowerPoint</p></div>
          <div><b>AI tools</b><p>Claude Code</p></div>
          <div><b>UX</b><p>CodePen.io</p></div>
        </div>
      </Reveal>
    </section>
  );
}

function App() {
  const [dark, setDark] = useState(() => !window.matchMedia('(prefers-color-scheme: light)').matches);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('reading');
  const [exporting, setExporting] = useState(false);
  const progress = useScrollProgress();
  const active = useActiveSection(NAV_SECTION_IDS);

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  const downloadSlideDeck = async () => {
    if (exporting) return;
    setExporting(true);
    const previousView = view;
    const appEl = document.querySelector('.app');
    setView('slides');
    appEl.setAttribute('data-exporting', 'true');
    try {
      await document.fonts.ready;
      // let the view-switch + exporting styles actually paint before capturing
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const nodes = [...document.querySelectorAll('.app[data-view="slides"] > .cover, .app[data-view="slides"] .slide, .app[data-view="slides"] .question')];
      const bg = getComputedStyle(appEl).getPropertyValue('--bg').trim() || '#ffffff';
      const muted = getComputedStyle(appEl).getPropertyValue('--muted').trim() || '#888888';
      const [bgR, bgG, bgB] = hexToRgb(bg);
      const [muR, muG, muB] = hexToRgb(muted);

      // Capture every section first and slice any section taller than one page
      // into per-page canvases, all before touching the PDF. The on-screen "Page
      // NN" tag baked into each section counts sections, not physical pages, so
      // once a section spills onto extra pages that tag only lands on one of them
      // (it's hidden for export — see [data-exporting] in styles.css) — page
      // numbers here are stamped afterwards against the deck's real, flat page
      // list instead.
      const pages = [];
      for (const node of nodes) {
        const offsets = computeBreakOffsets(node);
        const restoreColors = sanitizeExoticColors(node);
        let fullCanvas;
        try {
          fullCanvas = await html2canvas(node, {
            width: PAGE_W_PX,
            height: node.scrollHeight,
            scale: 2,
            backgroundColor: bg,
            useCORS: true,
          });
        } finally {
          restoreColors();
        }
        // Every page renders at the same fixed scale, so a slide's text is the same
        // size wherever it lands. A section taller than one page spills onto
        // consecutive full pages, split at the same safe boundaries the print
        // stylesheet uses — instead of shrinking the whole section to fit one page,
        // which used to make content-heavy slides look zoomed out next to short ones.
        const canvasScale = fullCanvas.width / PAGE_W_PX;
        for (let i = 0; i < offsets.length - 1; i++) {
          // A cut that lands exactly on a border (e.g. a card's bottom edge) can
          // have that border row rounded onto both sides of the split — the same
          // hairline appearing as the last row of one page and the first row of
          // the next. Nudging every non-first slice's start past it drops one
          // duplicate, invisible row instead of showing a stray line.
          const bleedGuard = i > 0 ? 2 : 0;
          const sy = Math.round(offsets[i] * canvasScale) + bleedGuard;
          const sh = Math.min(Math.round((offsets[i + 1] - offsets[i]) * canvasScale) - bleedGuard, fullCanvas.height - sy);
          // Every page canvas is the full physical page height, background baked
          // in, even when its content is shorter — so the PDF page is always one
          // single image. A shorter page used to end partway down and hand off to
          // a separately-drawn fill rectangle for the rest: two different PDF
          // draw operations meeting at a hard edge, which is exactly where some
          // viewers render a stray hairline (invisible in the source JPEG itself,
          // so it never showed up checking that).
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = fullCanvas.width;
          pageCanvas.height = Math.round(PAGE_H_PX * canvasScale);
          const ctx = pageCanvas.getContext('2d');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          // A page shorter than the full budget (the tail end of a section that
          // spilled onto an extra page, e.g. the appendix) used to sit pinned to
          // the top with all the slack dumped below it as a band of bare page
          // background under the last card — center it in the page instead so
          // the leftover space reads as intentional margin, not a leftover gap.
          const dy = Math.round((pageCanvas.height - sh) / 2);
          ctx.drawImage(fullCanvas, 0, sy, fullCanvas.width, sh, 0, dy, fullCanvas.width, sh);
          pages.push({ canvas: pageCanvas, canvasScale, contentBottom: dy + sh });
        }
      }

      // A page number only ever gets drawn where it's actually empty in that
      // page's own capture — a slice can end anywhere in the flow, so unlike the
      // on-screen tag (which always sits in a section's own reserved bottom
      // padding) there's no guarantee the corner it would land in is free. Checks
      // the exact box the text is about to occupy, not just "the corner" — a
      // fixed guess window can sit above or beside the real text and miss content
      // right behind it.
      function isRegionBlank(ctx, x, y, w, h) {
        x = Math.max(0, Math.round(x));
        y = Math.max(0, Math.round(y));
        w = Math.min(Math.round(w), ctx.canvas.width - x);
        h = Math.min(Math.round(h), ctx.canvas.height - y);
        if (w <= 0 || h <= 0) return false;
        const { data } = ctx.getImageData(x, y, w, h);
        for (let i = 0; i < data.length; i += 4 * 23) {
          if (Math.abs(data[i] - bgR) > 12 || Math.abs(data[i + 1] - bgG) > 12 || Math.abs(data[i + 2] - bgB) > 12) return false;
        }
        return true;
      }

      const doc = new jsPDF({ unit: 'in', format: [PAGE_W_IN, PAGE_H_IN], orientation: 'landscape' });
      pages.forEach(({ canvas, canvasScale, contentBottom }, idx) => {
        const ctx = canvas.getContext('2d');
        const label = `PAGE ${String(idx + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
        const fontPx = 10 * canvasScale;
        ctx.font = `${fontPx}px 'DM Mono', monospace`;
        const textW = ctx.measureText(label).width;
        const padX = 10 * canvasScale;
        const padY = 8 * canvasScale;
        const rightX = canvas.width - 42 * canvasScale;
        // Sits just above the content's own bottom edge, not the page's — a page
        // shorter than the budget is now centered rather than pinned to the top,
        // so anchoring to the fixed page bottom could land the label inside the
        // top-heavy margin above short content instead of just past it.
        const baselineY = Math.min(canvas.height - 30 * canvasScale, contentBottom - 30 * canvasScale);
        const boxX = rightX - textW - padX;
        const boxY = baselineY - fontPx - padY;
        const boxW = textW + padX * 2;
        const boxH = fontPx + padY * 2;
        if (isRegionBlank(ctx, boxX, boxY, boxW, boxH)) {
          ctx.fillStyle = `rgb(${muR}, ${muG}, ${muB})`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(label, rightX, baselineY);
        }

        if (idx > 0) doc.addPage([PAGE_W_IN, PAGE_H_IN], 'landscape');
        // The canvas is already the full page height with background baked in
        // (see above), so this image alone covers the entire page — no separate
        // fill rect underneath it to form a seam against.
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W_IN, PAGE_H_IN);
      });
      doc.save('Northbank-slide-deck.pdf');
    } finally {
      appEl.removeAttribute('data-exporting');
      setView(previousView);
      setExporting(false);
    }
  };

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setLoaded(true), reduced ? 120 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
    <Loader done={loaded} onDone={() => setLoaded(true)} />
    <main className="app" data-theme={dark ? 'dark' : 'light'} data-view={view}>
      <nav>
        <a className="wordmark" href="#top">northbank</a>
        <div className="nav-links">
          {NAV_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} title={s.title} className={active === s.id ? 'active' : ''}>{s.label}</a>
          ))}
        </div>
        <div className="nav-actions">
          <button className="view-btn" onClick={() => setView(view === 'reading' ? 'slides' : 'reading')} aria-pressed={view === 'slides'}>
            {view === 'slides' ? 'Reading view' : 'Slide view'}
          </button>
  <button className="download deck-download" onClick={downloadSlideDeck} disabled={exporting} aria-label="Download the slide deck as a PDF" aria-busy={exporting}>
    {exporting ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
    {exporting ? 'Downloading…' : 'Slide PDF'}
  </button>
  <button className="theme-btn" onClick={() => setDark(!dark)} aria-pressed={!dark} aria-label="Toggle color theme">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>
      <div className="progress-rail"><i style={{ '--p': progress }} /></div>
      <TocRail />

      <header className="cover" id="top">
        <div>
          <Eyebrow index="01">Northbank Case study</Eyebrow>
          <h1><Split>Northbank Case study</Split></h1>
          <p>A review of the unsecured-loan refinance funnel — where it converts, where it leaks, and where next quarter’s product effort should go.</p>
          <div className="cover-meta">
            <b>14 Sept 2026</b>
            <span>Cohorts <strong>Mar–Jun 2026, matured</strong></span>
            <span>Base <strong>40,000 offers</strong></span>
            <span>For <strong>Lendable</strong></span>
          </div>
          <div className="scroll-cue"><i />Scroll to read</div>
        </div>
      </header>

      <section className="slide agenda">
        <SectionHead eyebrow="Contents" title="Three questions, answered up front." />
        <div className="agenda-grid">
          {AGENDA.map((a) => (
            <a key={a.n} href={a.href} className={a.muted ? 'muted-card' : ''}>
              <b>{a.n}</b>
              <h3>{a.title}</h3>
              <p>{a.dek}</p>
              <span>{a.n === '—' ? 'Appendix' : `Jump to ${a.n}`} <ArrowRight size={12} /></span>
            </a>
          ))}
        </div>
      </section>

      <div id="q1" className="zone">
        <QuestionDivider n={1}>Using the data available, report on how the funnel is working — which areas are doing well, and which could be improved.</QuestionDivider>
        <Overview />
        <FunnelLeakTable />
        <Verdict />
        <OpportunityCuts />
      </div>

      <div id="q2" className="zone">
        <QuestionDivider n={2} note="“We expect this to take well under an hour — we’re interested in what you choose to put on the slide.”">Summarise the major findings from the customer survey for the product team in one slide or less.</QuestionDivider>
        <Survey />
      </div>

      <div id="q3" className="zone">
        <QuestionDivider n={3}>Create a list of 5–10 initiatives to prioritise for the refinance cross-sell product next quarter, and briefly justify the ordering.</QuestionDivider>
        <Matrix />
        <Rationale />
      </div>

      <Appendix />

      <footer>
        <span>Northbank · Refinance cross-sell · Source: funnel.csv, quotes.csv and survey.csv</span>
        <a className="back-top" href="#top">Back to top <ArrowUp size={12} /></a>
      </footer>
    </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
