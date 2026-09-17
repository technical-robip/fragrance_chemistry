import { useState } from 'react';
import styles from './SuppliersPage.module.css';

const regions = ['EU', 'US', 'APAC'] as const;

type Supplier = {
  name: string;
  leadDays: number;
  moqKg: number;
  notes: string;
};

const byRegion: Record<(typeof regions)[number], Supplier[]> = {
  EU: [
    {
      name: 'Alpine Aromatics GmbH',
      leadDays: 5,
      moqKg: 1,
      notes: 'IFRA docs on request',
    },
    {
      name: 'Mediterranean Naturals',
      leadDays: 9,
      moqKg: 0.5,
      notes: 'Citrus specialty',
    },
  ],
  US: [
    {
      name: 'Pacific Compounding Co.',
      leadDays: 4,
      moqKg: 2,
      notes: 'Same-day COA portal',
    },
  ],
  APAC: [
    {
      name: 'Osaka Fine Chemicals',
      leadDays: 14,
      moqKg: 5,
      notes: 'Bulk iso E allocations',
    },
  ],
};

export function SuppliersPage() {
  const [region, setRegion] = useState<(typeof regions)[number]>('EU');
  const suppliers = byRegion[region];

  return (
    <div>
      <h1 className="fc-page-title">Suppliers</h1>
      <p className="fc-muted">Regional sourcing tabs — link to vendor API later.</p>

      <div className={styles.tabs} role="tablist" aria-label="Supplier regions">
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={region === r}
            className={region === r ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setRegion(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className={`fc-table-wrap ${styles.table}`}>
        <table className="fc-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Lead (days)</th>
              <th>MOQ (kg)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.leadDays}</td>
                <td>{s.moqKg}</td>
                <td>{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
