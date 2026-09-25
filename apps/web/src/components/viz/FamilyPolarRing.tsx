import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CompositionLegend } from './CompositionLegend';
import styles from './FamilyPolarRing.module.css';

const COLORS = [
  'var(--fc-note-top)',
  'var(--fc-note-heart)',
  'var(--fc-note-base)',
  'var(--fc-accent)',
  'var(--fc-warn)',
  '#6ecf9a',
  '#c4785a',
  '#a67c52',
  '#9b7bb8',
];

export function FamilyPolarRing({
  data,
  centerLabel = 'Families',
  activeId,
  onSelect,
  emptyLabel,
}: {
  data: { name: string; value: number }[];
  centerLabel?: string;
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const withPct = data.map((d) => ({ ...d, pct: (d.value / total) * 100 }));

  if (data.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>{emptyLabel ?? 'No olfactory families tagged yet.'}</p>
      </div>
    );
  }

  function select(id: string) {
    onSelect?.(activeId === id ? null : id);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={withPct}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={3}
              stroke="transparent"
              onClick={(_, index) => {
                const item = withPct[index];
                if (item) select(item.name);
              }}
              style={{ cursor: onSelect ? 'pointer' : undefined }}
            >
              {withPct.map((d, i) => {
                const dimmed = activeId != null && activeId !== d.name;
                return (
                  <Cell
                    key={d.name}
                    fill={COLORS[i % COLORS.length]}
                    stroke={activeId === d.name ? 'rgba(255,255,255,0.55)' : 'transparent'}
                    strokeWidth={activeId === d.name ? 2 : 0}
                    opacity={dimmed ? 0.4 : 1}
                  />
                );
              })}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}% share`, String(name)]}
              contentStyle={{
                background: 'var(--fc-surface)',
                border: 'var(--fc-border)',
                borderRadius: 8,
                color: 'var(--fc-text)',
                fontSize: 14,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.center}>
          <strong>{centerLabel}</strong>
          <span>
            {data.length} group{data.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <CompositionLegend
        items={withPct.map((d, i) => ({
          id: d.name,
          label: d.name,
          percent: d.pct,
          color: COLORS[i % COLORS.length]!,
        }))}
        activeId={activeId}
        onSelect={select}
      />
    </div>
  );
}
