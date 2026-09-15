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
  { name: 'Viewed offer', note: '62% of offers were never opened. The single largest leak.', carry: 37.96, lost: 62.04, lostLabel: '−24,815', stepConv: '38.0%', strong: true },
  { name: 'Tapped apply', note: '80.8% of everyone who viewed the offer never went on to apply.', carry: 7.3, lost: 30.67, lostLabel: '−12,267', stepConv: '19.2%', strong: true },
  { name: 'Requirements done', note: '39% stalled on standard identity and income checks.', carry: 4.44, lost: 2.86, lostLabel: '−1,143', stepConv: '60.8%', dim: true },
  { name: 'Settlement uploaded', note: "A median nine-day wait on the customer's old lender.", carry: 3.34, lost: 1.1, lostLabel: '−439', stepConv: '75.3%', dim: true },
  { name: 'Settlement verified', note: 'Drop after settlement quote upload;', carry: 2.45, lost: 0.9, lostLabel: '−358', stepConv: '73.2%', dim: true },
  { name: 'Loan funded', note: 'The strongest step in the funnel: 92.9% of verified applicants fund.', carry: 2.27, lost: 0.17, lostLabel: '−69', stepConv: '92.9%', strong: true, final: true },
];

const DOING_WELL = [
  { n: '01', title: 'Push is associated with roughly 2× engagement', detail: '~2× lift in view, apply and loan rate at every stage, but only 45% of offers carry one.' },
  { n: '02', title: 'Verified applicants almost always fund.', detail: '909 of 978 verified applicants are funded. The strongest step in the funnel.' },
  { n: '03', title: 'Month-on-month performance is steady', detail: 'Offer-to-loan holds flat at 2.1–2.6% across four matured cohorts.' },
];

const OPPORTUNITIES = [
  {
    n: '01', title: 'Reach and engagement', detail: <><strong>Offer reach</strong><br />62% never opened. 24,815 lost; largest observed leak.<br /><br /><strong>Repeat-offer policy</strong><br />Apply rate halves at every repeat offer; 13.6% down to 2.0%.</>,
  },
  {
    n: '02', title: 'Proposition & intent', detail: <><strong>Offer value</strong><br />12,267 viewers do not apply; total-cost saving is associated with higher view → apply.</>,
  },
  {
    n: '03', title: 'Conversion and servicing', detail: <><strong>Application completion</strong><br />39% never complete identity and income checks.<br /><br /><strong>Settlement verification</strong><br />358 customers drop after quote upload; root cause requires investigation (e.g. is lender supported?)</>,
  },
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
  reach: 'Reach & engagement',
  proposition: 'Proposition & intent',
  conversion: 'Conversion & servicing',
};

const INITIATIVES = [
  { n: '01', title: 'Expand offer reach', evidence: 'Expand push to more eligible customers and test send timing to increase offer visibility. 52.4% vs 26.0% viewed with vs without push.', quadrant: 'Do now', group: 'reach', x: 25, y: 33 },
  { n: '02', title: 'Test repeat-offer cadence and targeting', evidence: 'Test when and how often repeat offers are sent, and tailor the next offer to customer needs such as monthly payment vs total cost. View → Apply falls 31.1% → 6.7% from offer 1 to 4.', quadrant: 'Do now', group: 'reach', x: 28, y: 49 },
  { n: '03', title: 'Improve offer value & framing', evidence: 'Review APR/term economics and test tailored value framing, such as monthly payment vs total saving. Only 19.2% of viewers apply; conversion varies materially by APR, term and total-cost saving.', quadrant: 'Do now', group: 'proposition', x: 31, y: 57 },
  { n: '04', title: 'Set a total-cost saving threshold', evidence: 'Review offers that lower monthly payments but increase total cost; test whether clearer value framing or pricing changes improve uptake. 38.4% fall into this group.', quadrant: 'Plan', group: 'proposition', x: 70, y: 42 },
  { n: '05', title: 'Simplify digital application experience', evidence: 'Reduce application effort by pre-filling known information and identifying the requirements causing abandonment. 60.8% complete requirements.', quadrant: 'Plan', group: 'conversion', x: 64, y: 57 },
  { n: '06', title: 'Fix settlement verification drop-off', evidence: 'Capture why verification fails, then address the largest causes.', quadrant: 'Plan', group: 'conversion', x: 71, y: 20 },
  { n: '07', title: 'Improve settlement status guidance', evidence: 'Give customers clearer progress, next steps and expectations while settlement is being verified. Survey feedback indicates uncertainty during the settlement wait.', quadrant: 'Do now', group: 'conversion', x: 31, y: 68 },
  { n: '08', title: 'Test trust & reassurance interventions', evidence: 'Audit existing support/trust signals and test targeted in-app (or web) reassurance for hesitant customers (e.g. FAQs or contact options). Survey feedback indicates demand for human reassurance.', quadrant: 'Fill-in', group: 'conversion', x: 24, y: 76 },
];

const RATIONALE = [
  {
    name: 'Reach & engagement',
    feel: '“It was one email among many, and nothing followed it up.”',
    assumption: 'Assumes the push lift is causal, not a proxy for app-engaged customers. Test: randomised push eligibility, send timing and cadence.',
    capability: 'Channel orchestration — broader push eligibility, send-time testing and cadence control across push, email and in-app.',
  },
  {
    name: 'Proposition & intent',
    feel: '“Lower monthly but a longer term. I’d pay about £600 more in the end.”',
    assumption: 'Assumes offer economics and framing drive the gap, not intent. Test: tailored value framing and minimum-saving thresholds.',
    capability: 'Offer value engine — APR/term review, saving thresholds and value framing tuned to customer economics.',
  },
  {
    name: 'Conversion & servicing',
    feel: '“Started the application but it was taking too long so I left it.” · “Waiting on my lender for the settlement figure, it never came.”',
    assumption: 'Assumes drop-off is effort and uncertainty, not eligibility. The verification cause stays unknown until failure reasons are captured. Test: pre-filled flow, instrumented failures, proactive status.',
    capability: 'Pre-fill and save-and-resume, failure-reason instrumentation, proactive settlement status and targeted reassurance.',
  },
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
          <p>24,815 offers are never viewed. The largest leak.</p>
        </Tilt>
        <Tilt>
          <small>Push effect</small>
          <b>~2× <Evidence query="channel_effectiveness.sql">Groups the funnel by <code>push_sent</code>. All offers were emailed, so it measures push on top of email, not email’s standalone effect.</Evidence></b>
          <p>higher offer view, apply and loan rates among push recipients.</p>
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
        title="Most losses happen at two points."
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
        dek="Offer reach is the largest observed leak. Offer value is the next key opportunity. Settlement verification is a confirmed hard stop for a smaller group."
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
      <p className="body-note">~2× lift in view, apply and loan rate at every stage, but only 45% of offers carry one.</p>
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
      <p className="body-note">Review APR/term economics and test tailored value framing, such as monthly payment vs total saving. Only 19.2% of viewers apply; conversion varies materially by APR, term and total-cost saving.</p>
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
      <p className="drift-note">Test when and how often repeat offers are sent, and tailor the next offer to customer needs such as monthly payment vs total cost. View → Apply falls 31.1% → 6.7% from offer 1 to 4.</p>
    </>
  );
}

function SettlementBody() {
  return (
    <>
      <div className="stat-pair">
        <div><b>358</b><small>customers drop after quote upload</small></div>
        <div><b>73.2%</b><small>step conversion</small></div>
      </div>
      <p className="body-note">Root cause requires investigation (e.g. is lender supported?)</p>
    </>
  );
}

const OPPORTUNITY_CARDS = {
  reach: { eyebrow: 'Offer reach', title: '62% never opened. 24,815 lost; largest observed leak.', Body: ReachBody },
  value: { eyebrow: 'Offer value', title: '12,267 viewers do not apply; total-cost saving is associated with higher view → apply.', Body: PropositionBody },
  friction: { eyebrow: 'Conversion & servicing', title: 'Simplify digital application experience', Body: ExperienceBody },
  settlement: { eyebrow: 'Settlement verification', title: '358 customers drop after quote upload.', Body: SettlementBody },
};

function OpportunityCuts() {
  const [expanded, setExpanded] = useState(null);
  const active = expanded ? OPPORTUNITY_CARDS[expanded] : null;

  return (
    <section className="slide executive-opportunities" id="opportunities">
      <SectionHead
        eyebrow="Q1 · Opportunities"
        title="Most conversion is lost before people apply."
        dek="Offer reach is the largest observed leak. Offer value is the next key opportunity."
      />
      <div className="opportunity-frame">
        <Reveal className="primary-leak-hero">
          <div className="opportunity-kicker"><span>Offer reach</span><span>Largest observed leak</span></div>
          <h3>Offer engagement</h3>
          <div className="verification-stat"><b>24,815</b><span>offers are never viewed</span></div>
          <div className="verification-proof"><b>62%</b><span>of offers were never opened</span></div>
          <div className="primary-loss-visual" aria-label="63.5% of all losses are offers never opened, 31.4% are opened but not applied for, and 5.1% occur in the application"><i /><i /><i /></div>
          <p><strong>~2× lift in view, apply and loan rate at every stage, but only 45% of offers carry one.</strong></p>
        </Reveal>

        <div className="secondary-leaks">
          <div className="opportunity-kicker"><span>Could be improved</span><span>Offer value, application completion and settlement verification</span></div>
          <Reveal className="executive-leak" delay={0}>
            <div>
              <div className="exec-card-kicker"><span>Offer value</span><button className="expand-btn" onClick={() => setExpanded('value')} aria-label="Expand offer value analysis"><Maximize2 size={14} /></button></div>
              <h3>80.8% <em>of viewers do not apply</em></h3>
          <p>12,267 viewers do not apply; total-cost saving is associated with higher view → apply.</p>
            </div>
            <div className="exec-visual value-visual" aria-label="View to apply rate by APR quartile: 29.7%, 22.3%, 15.4%, and 9.5% from lowest to highest APR"><i><b>29.7</b></i><i><b>22.3</b></i><i><b>15.4</b></i><i><b>9.5</b></i></div>
          </Reveal>
          <Reveal className="executive-leak" delay={80}>
            <div>
              <div className="exec-card-kicker"><span>Settlement verification</span><div className="exec-card-actions"><button className="expand-btn" onClick={() => setExpanded('settlement')} aria-label="Expand settlement verification analysis"><Maximize2 size={14} /></button></div></div>
              <h3>358 <em>customers drop after quote upload</em></h3>
              <p>root cause requires investigation (e.g. is lender supported?)</p>
            </div>
            <div className="exec-visual verification-visual" aria-label="358 customers drop after quote upload"><i /><b>358</b></div>
          </Reveal>
          <Reveal className="executive-leak" delay={160}>
            <div>
              <div className="exec-card-kicker"><span>Application completion</span><button className="expand-btn" onClick={() => setExpanded('friction')} aria-label="Expand application and repeat-offer analysis"><Maximize2 size={14} /></button></div>
              <h3>39% <em>stall on requirements</em></h3>
              <p>39% never complete identity and income checks.</p>
            </div>
            <div className="exec-visual momentum-visual" aria-label="Apply rate drops from 13.6% on the first offer to 2.0% on the fourth"><i><b>13.6</b></i><i><b>6.5</b></i><i><b>3.4</b></i><i><b>2.0</b></i></div>
          </Reveal>
        </div>
      </div>
      <div className="executive-takeaway"><span>Could be improved</span><p>39% never complete identity and income checks.</p></div>
      <p className="opportunity-source">Northbank · Refinance cross-sell · Source: funnel.csv, quotes.csv and survey.csv</p>
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
        title="Non-takers highlight four barriers."
        dek="Value, reassurance, effort and lender dependencies shape the decision."
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
      <p className="survey-foot">survey.csv · 300 comments coded by theme</p>
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
        title="Eight recommendations, led by the biggest leak: four in five customers who see an offer never apply."
      />
      <Reveal className="matrix-layout">
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
        title="What to prioritise next quarter"
        dek="Every initiative from the previous slide sits under its theme: what customers said, what the data shows, what we’re assuming, and what we’d build"
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
            {r.data && <div className="rationale-row">
              <span>Data shows</span>
              <p>{r.data}</p>
            </div>}
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
        title="Working notes, queries and tools."
      />
      <Reveal className="appendix-provenance">
        <div className="method-notes" aria-label="Approach">
          <span>Approach</span>
          <article>
            <b>01 · Start with the shape of the data</b>
            <p>Checked the CSV grain, date coverage and 1:1 <code>application_id</code> join before drawing conclusions.</p>
          </article>
          <article>
            <b>02 · Where does the funnel actually break?</b>
            <p>Counted each dated event, then compared losses by volume and step conversion. The first two customer decisions dominate.</p>
          </article>
          <article>
            <b>03 · Reach, value or completion?</b>
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
          <div><b>Presentation</b><p>Google Slides</p></div>
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
    try {
      const pdfUrl = new URL('../docs/northbank.pdf', import.meta.url).href;
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'northbank.pdf';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => setExporting(false), 300);
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
    <main className="app" data-theme={dark ? 'dark' : 'light'}>
      <nav>
        <a className="wordmark" href="#top">northbank</a>
        <div className="nav-links">
          {NAV_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} title={s.title} className={active === s.id ? 'active' : ''}>{s.label}</a>
          ))}
        </div>
        <div className="nav-actions">
  <button className="download deck-download" onClick={downloadSlideDeck} disabled={exporting} aria-label="Download the slide deck as a PDF" aria-busy={exporting}>
    {exporting ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
    {exporting ? 'Downloading…' : 'Download PDF'}
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
          <Eyebrow index="01">Northbank case study</Eyebrow>
          <h1><Split>Northbank case study</Split></h1>
          <p>A review of the unsecured-loan refinance funnel: where the funnel works, where customers drop off, and what to prioritise next.</p>
          <div className="cover-meta">
            <b>15 Sept 2026</b>
            <span>By <strong>Samuel Awonuga</strong></span>
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
