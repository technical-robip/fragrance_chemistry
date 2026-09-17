import { FormEvent, useState } from 'react';
import styles from './EncyclopediaPage.module.css';

type BriefSection = {
  title: string;
  body: string;
};

const sampleEntry = {
  name: 'Iso E Super',
  descriptor: 'Woody amber, velvety, expansive',
  sections: [
    {
      title: 'Olfactive profile',
      body: 'Soft cedarwood envelope with a transparent, slightly sweet amber nuance. Builds radiance without sharpness.',
    },
    {
      title: 'Use level',
      body: 'Typical fine fragrance use 5–25%; can dominate if overdosed. Pairs with citrus top notes and musk bases.',
    },
  ] satisfies BriefSection[],
};

export function EncyclopediaPage() {
  const [query, setQuery] = useState('Iso E Super');
  const [brief, setBrief] = useState<BriefSection[] | null>(null);
  const [generating, setGenerating] = useState(false);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 700));
    setBrief(
      query.toLowerCase().includes('iso')
        ? sampleEntry.sections
        : [
            {
              title: 'Lab brief',
              body: `Placeholder brief for “${query}”. Wire POST /encyclopedia/brief to your generator service.`,
            },
          ],
    );
    setGenerating(false);
  }

  return (
    <div>
      <h1 className="fc-page-title">Encyclopedia</h1>
      <p className="fc-muted">Material intelligence and generated lab briefs for the bench.</p>

      <form className={`fc-card ${styles.search}`} onSubmit={onGenerate}>
        <label className="fc-label" htmlFor="material-query">
          Material or accord
        </label>
        <div className={styles.row}>
          <input
            id="material-query"
            className="fc-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="fc-btn fc-btn--amber" disabled={generating}>
            {generating ? 'Generating…' : 'Generate lab brief'}
          </button>
        </div>
      </form>

      <article className={`fc-card ${styles.entry}`}>
        <h2>{sampleEntry.name}</h2>
        <p className={styles.descriptor}>{sampleEntry.descriptor}</p>
        {sampleEntry.sections.map((section) => (
          <section key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </section>
        ))}
      </article>

      {brief ? (
        <article className={`fc-card ${styles.brief}`}>
          <h2>Generated lab brief</h2>
          {brief.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </article>
      ) : null}
    </div>
  );
}
