import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import styles from './SuppliersPage.module.css';

const regions = ['US', 'UK-EU', 'UAE', 'ASIA', 'All'] as const;

type Supplier = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  region: string | null;
  country: string | null;
};

export function SuppliersPage() {
  const [region, setRegion] = useState<(typeof regions)[number]>('All');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<Supplier[]>('/suppliers'),
  });

  const suppliers = useMemo(() => {
    const list = data ?? [];
    if (region === 'All') return list;
    return list.filter((s) => (s.region ?? '').toUpperCase() === region.toUpperCase());
  }, [data, region]);

  return (
    <div>
      <h1 className="fc-page-title">Suppliers</h1>
      <p className="fc-muted">Regional sourcing directory from the catalog API.</p>

      <div className={styles.tabs} role="tablist" aria-label="Supplier regions">
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={region === r}
            className={region === r ? styles.tabActive : styles.tab}
            onClick={() => setRegion(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {isLoading ? <p className="fc-muted">Loading suppliers…</p> : null}
      {isError ? <p className="fc-muted">Could not load suppliers.</p> : null}

      <div className={styles.grid}>
        {suppliers.map((s) => (
          <article key={s.id} className={`fc-card ${styles.card}`}>
            <h2>{s.name}</h2>
            <p className="fc-muted">
              {[s.region, s.country].filter(Boolean).join(' · ') || 'Unspecified region'}
            </p>
            {s.website ? (
              <a href={s.website} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {s.notes ? <p>{s.notes}</p> : null}
          </article>
        ))}
        {!isLoading && suppliers.length === 0 ? (
          <p className="fc-muted">No suppliers in this region yet.</p>
        ) : null}
      </div>
    </div>
  );
}
