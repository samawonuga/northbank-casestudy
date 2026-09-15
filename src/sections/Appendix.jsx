import { SectionHead, Reveal } from '../ui.jsx';

export function Appendix() {
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
            <b>01 · Started with the shape of the data</b>
            <p>Checked the CSV structure and date coverage, then joined the datasets on <code>application_id</code> to analyse the full customer journey.</p>
          </article>
          <article>
            <b>02 · Where does the funnel actually break?</b>
            <p>Used SQL to turn dated customer events into a funnel, calculate conversion at each stage, and quantify drop-off by volume.</p>
          </article>
          <article>
            <b>03 · Reach, value or completion?</b>
            <p>Compared funnel conversion by push notification, offer economics and repeat exposure. Used survey comments to explain observed patterns</p>
          </article>
          <article>
            <b>04 · What should happen first?</b>
            <p>Identified where customers drop off from the data, but treated the reasons for drop-off as hypotheses to test. Prioritised initiatives by customer impact, effort and dependencies.</p>
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
          <div><b>AI tools</b><p>Claude</p></div>
          <div><b>UX</b><p>CodePen.io</p></div>
        </div>
      </Reveal>
    </section>
  );
}
