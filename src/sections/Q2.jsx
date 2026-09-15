import { SectionHead, Reveal } from '../ui.jsx';
import { SURVEY } from '../content/survey.js';

export function Survey() {
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
