import { useMemo, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import styles from './CatalogPage.module.css';

type MaterialRow = {
  code: string;
  name: string;
  family: string;
  cas?: string;
  stockG: number;
};

const demoMaterials: MaterialRow[] = Array.from({ length: 120 }, (_, i) => ({
  code: `MAT-${String(i + 1).padStart(4, '0')}`,
  name: `Material ${i + 1}`,
  family: ['Citrus', 'Woody', 'Floral', 'Balsamic'][i % 4]!,
  cas: i % 3 === 0 ? `${100 + i}-${20 + (i % 10)}-${i}` : undefined,
  stockG: Math.round(((i * 17) % 5000) + 120) / 10,
}));

const columnHelper = createColumnHelper<MaterialRow>();

export function CatalogPage() {
  const columns = useMemo(
    () => [
      columnHelper.accessor('code', { header: 'Code', size: 120 }),
      columnHelper.accessor('name', { header: 'Name', size: 220 }),
      columnHelper.accessor('family', { header: 'Family', size: 100 }),
      columnHelper.accessor('cas', {
        header: 'CAS',
        size: 140,
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('stockG', {
        header: 'Stock (g)',
        size: 100,
        cell: (info) => info.getValue().toFixed(1),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: demoMaterials,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const template = headers.map((h) => `${h.column.getSize()}px`).join(' ');

  return (
    <div>
      <h1 className="fc-page-title">Catalog</h1>
      <p className="fc-muted" style={{ marginBottom: '1rem' }}>
        Virtualized material index — swap demo rows for <code>/materials</code> when the API is
        live.
      </p>
      <div ref={parentRef} className={`fc-table-wrap ${styles.virtual}`}>
        <div className={styles.headerRow} style={{ gridTemplateColumns: template }}>
          {headers.map((header) => (
            <span key={header.id} className={styles.headerCell}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
          ))}
        </div>
        <div className={styles.body} style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]!;
            return (
              <div
                key={row.id}
                className={styles.row}
                style={{
                  height: `${vRow.size}px`,
                  transform: `translateY(${vRow.start}px)`,
                  gridTemplateColumns: template,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <span key={cell.id} className={styles.cell}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
