import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TOC_GROUPS, TOC_IDS } from './content/nav.js';
import { useActiveSection } from './hooks.js';

export function Split({ children }) {
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

export function Eyebrow({ index, children }) {
  return (
    <div className="eyebrow">
      {index && <span>{index}</span>}
      {children}
    </div>
  );
}

export function SectionHead({ eyebrow, title, dek, split }) {
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

export function Tilt({ children, className = '' }) {
  return <article className={`tilt-card ${className}`}>{children}</article>;
}

export function QuestionDivider({ n, children, note }) {
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

export function Reveal({ children, as: Tag = 'div', className = '', delay = 0 }) {
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

export function TocRail() {
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

export function Modal({ eyebrow, title, tag, onClose, children }) {
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

export function ConfidenceTag({ confirmed }) {
  return confirmed
    ? <span className="tag">Confirmed</span>
    : <span className="correlational-tag">Correlational</span>;
}

export function Evidence({ query, queryFile, method, children }) {
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

export function Loader({ done, onDone }) {
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
