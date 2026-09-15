import { useState } from 'react';
import { SectionHead, Reveal, ConfidenceTag } from '../ui.jsx';
import { THEME_LABELS, INITIATIVES, RATIONALE } from '../content/initiatives.js';

export function Matrix() {
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
          <div className="axis x">Delivery complexity &amp; dependencies <span>high</span></div>
          <div className="quadrant q1">Build next</div>
          <div className="quadrant q2">Win quickly</div>
          <div className="quadrant q3">Keep on radar</div>
          <div className="quadrant q4">Defer</div>
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

export function Rationale() {
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
