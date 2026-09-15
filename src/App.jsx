import { useEffect, useState } from 'react';
import { Download, Loader2, Sun, Moon, ArrowRight, ArrowUp } from 'lucide-react';
import { Loader, Eyebrow, Split, SectionHead, QuestionDivider, TocRail } from './ui.jsx';
import { useScrollProgress, useActiveSection } from './hooks.js';
import { NAV_SECTIONS, NAV_SECTION_IDS, AGENDA } from './content/nav.js';
import { Overview, FunnelLeakTable, Verdict, OpportunityCuts } from './sections/Q1.jsx';
import { Survey } from './sections/Q2.jsx';
import { Matrix, Rationale } from './sections/Q3.jsx';
import { Appendix } from './sections/Appendix.jsx';

export default function App() {
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
      const pdfUrl = new URL('../docs/pdf/northbank.pdf', import.meta.url).href;
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
        <SectionHead eyebrow="Contents" title="Three questions answered." />
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
        <QuestionDivider n={2}>Summarise the major findings from the customer survey for the product team in one slide or less.</QuestionDivider>
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
