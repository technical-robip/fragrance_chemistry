import {
  previewLayerMaterials,
  type PyramidLayerId,
  type PyramidLayerItem,
} from '@/lib/formula-viz';
import styles from './PyramidLayerSummary.module.css';

export type PyramidLayerSummaryLayer = {
  id: PyramidLayerId;
  label: string;
  color: string;
  items: PyramidLayerItem[];
};

type Props = {
  layers: PyramidLayerSummaryLayer[];
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  emptyLabel: string;
  moreLabel: (count: number) => string;
  previewLimit?: number;
};

function formatPct(value: number) {
  if (value === 0) return '0%';
  if (value > 0 && value < 0.1) return '<0.1%';
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

export function PyramidLayerSummary({
  layers,
  activeId,
  onSelect,
  onHover,
  emptyLabel,
  moreLabel,
  previewLimit = 2,
}: Props) {
  const hasContent = layers.some((layer) => layer.items.length > 0);
  const visible = hasContent
    ? layers.filter((layer) => layer.id !== 'modifier' || layer.items.length > 0)
    : [];

  function select(id: string) {
    onSelect?.(activeId === id ? null : id);
  }

  if (!hasContent) {
    return (
      <p className={styles.empty} data-testid="pyramid-layer-empty">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={styles.list} data-testid="pyramid-layer-summary">
      {visible.map((layer) => {
        const active = activeId === layer.id;
        const preview = previewLayerMaterials(layer.items, previewLimit);
        return (
          <li key={layer.id} className={`${styles.row} ${active ? styles.rowActive : ''}`}>
            <button
              type="button"
              className={styles.item}
              aria-pressed={active}
              onClick={() => select(layer.id)}
              onMouseEnter={() => onHover?.(layer.id)}
              onMouseLeave={() => onHover?.(null)}
            >
              <span className={styles.swatch} style={{ background: layer.color }} />
              <span className={styles.meta}>
                <strong>{layer.label}</strong>
                <em>{layer.items.length}</em>
              </span>
              <span className={styles.preview}>
                {layer.items.length === 0
                  ? '—'
                  : [
                      ...preview.shown.map((item) => `${item.name} ${formatPct(item.percent)}`),
                      preview.rest > 0 ? moreLabel(preview.rest) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </span>
            </button>
            {active && layer.items.length > 0 ? (
              <ul className={styles.expanded} data-testid="pyramid-layer-expanded">
                {layer.items.map((item) => (
                  <li key={item.key}>
                    <span>{item.name}</span>
                    <em>{formatPct(item.percent)}</em>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
