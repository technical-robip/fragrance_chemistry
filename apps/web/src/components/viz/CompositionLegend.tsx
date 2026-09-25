import styles from './CompositionLegend.module.css';

export type LegendItem = {
  id: string;
  label: string;
  percent: number;
  color: string;
};

type Props = {
  items: LegendItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
};

export function CompositionLegend({ items, activeId, onSelect, onHover }: Props) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`${styles.item} ${active ? styles.active : ''}`}
              onClick={() => onSelect?.(item.id)}
              onMouseEnter={() => onHover?.(item.id)}
              onMouseLeave={() => onHover?.(null)}
              aria-pressed={active}
            >
              <span className={styles.swatch} style={{ background: item.color }} />
              <strong>{item.label}</strong>
              <em>{item.percent.toFixed(1)}%</em>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
