import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import styles from './DashboardPage.module.css';

type DashboardStats = {
  activeFormulas: number;
  materialsTracked: number;
  pendingEvaluations: number;
  lowStockItems: number;
};

async function fetchStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/dashboard/stats');
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchStats,
    placeholderData: {
      activeFormulas: 12,
      materialsTracked: 486,
      pendingEvaluations: 3,
      lowStockItems: 7,
    },
  });

  const stats = data!;

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className="fc-page-title">Dashboard</h1>
          <p className="fc-muted">
            Today&apos;s formulation pulse across catalog, bench, and supply.
          </p>
        </div>
        <Link to="/workbench" className="fc-btn fc-btn--amber">
          Open workbench
        </Link>
      </header>

      {isError ? (
        <p className={styles.banner}>
          Live stats unavailable — showing cached lab placeholders until the API responds.
        </p>
      ) : null}

      <div className={styles.grid}>
        {(
          [
            ['Active formulas', stats.activeFormulas],
            ['Materials tracked', stats.materialsTracked],
            ['Pending evaluations', stats.pendingEvaluations],
            ['Low stock alerts', stats.lowStockItems],
          ] as const
        ).map(([label, value]) => (
          <article key={label} className={`fc-card ${styles.stat}`}>
            <span className={styles.statLabel}>{label}</span>
            <strong className={styles.statValue}>{isLoading ? '…' : value}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}
