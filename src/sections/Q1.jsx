import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { SectionHead, Tilt, Reveal, Evidence, Modal, ConfidenceTag } from '../ui.jsx';
import { FUNNEL_LOSSES, DOING_WELL, OPPORTUNITIES, CHANNEL_ROWS, APR_QUARTILES, REOFFER } from '../content/funnel.jsx';

export function Overview() {
  return (
    <section className="slide" id="overview">
      <SectionHead
        eyebrow="Q1 · Funnel review"
        title="The funnel works after people engage. Most of the drop-off happens before they open the offer."
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

export function FunnelLeakTable() {
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

export function Verdict() {
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
      <p className="body-note">Push offers have ~2× higher view, apply and loan rates; only 45% include push.</p>
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
              <div className="bar"><i style={{ '--w': `${(r.apply / 31.1) * 100}%` }} /></div>
              <b>{r.apply}% / {r.loan}%</b>
            </div>
          ))}
        </div>
        <p className="chart-caption">View → apply % / loan % of offers sent, by re-offer attempt. <Evidence query="repeat_exposure.sql">Joins <code>funnel.csv</code> to <code>quotes.csv</code> on <code>application_id</code> and groups by <code>offer_number</code>.</Evidence></p>
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
      <p className="body-note">root cause requires investigation (e.g. is lender supported?)</p>
    </>
  );
}

const OPPORTUNITY_CARDS = {
  reach: { eyebrow: 'Offer reach', title: '62% never opened. 24,815 lost; largest observed leak.', Body: ReachBody },
  value: { eyebrow: 'Offer value', title: '12,267 viewers do not apply; total-cost saving is associated with higher view → apply.', Body: PropositionBody },
  friction: { eyebrow: 'Conversion & servicing', title: 'Simplify digital application experience', Body: ExperienceBody },
  settlement: { eyebrow: 'Settlement verification', title: '358 customers drop after quote upload.', confirmed: true, Body: SettlementBody },
};

export function OpportunityCuts() {
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
          <h3>Offer reach</h3>
          <div className="verification-stat"><b>24,815</b><span>offers are never viewed</span></div>
          <div className="verification-proof"><b>62%</b><span>of offers were never opened</span></div>
          <div className="primary-loss-visual" aria-label="63.5% of all losses are offers never opened, 31.4% are opened but not applied for, and 5.1% occur in the application"><i /><i /><i /></div>
          <p><strong>Push offers have ~2× higher view, apply and loan rates; only 45% include push.</strong></p>
        </Reveal>

        <div className="secondary-leaks">
          <div className="opportunity-kicker"><span>Could be improved</span><span>Offer value, repeat-offer policy and settlement verification</span></div>
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
              <div className="exec-card-kicker"><span>Repeat-offer policy</span><button className="expand-btn" onClick={() => setExpanded('friction')} aria-label="Expand application and repeat-offer analysis"><Maximize2 size={14} /></button></div>
              <h3>31.1% → 6.7% <em>view → apply rate across repeat offers</em></h3>
              <p>View → apply rate falls sharply with each repeat offer; 39% also never complete identity and income checks.</p>
            </div>
            <div className="exec-visual momentum-visual" aria-label="View to apply rate drops from 31.1% on the first offer to 6.7% on the fourth"><i><b>31.1</b></i><i><b>16.8</b></i><i><b>9.7</b></i><i><b>6.7</b></i></div>
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
