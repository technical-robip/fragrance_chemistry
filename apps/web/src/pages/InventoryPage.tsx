import styles from './InventoryPage.module.css';

const lots = [
  { sku: 'ISO-E-SUP', lot: 'L-2409-A', qtyG: 2500, location: 'Cold A1' },
  { sku: 'BERG-OIL', lot: 'L-2411-C', qtyG: 420, location: 'Cold B2' },
  { sku: 'VANILLIN', lot: 'L-2408-X', qtyG: 85, location: 'Dry D4' },
];

export function InventoryPage() {
  return (
    <div>
      <h1 className="fc-page-title">Inventory</h1>
      <p className="fc-muted">Lot-level stock positions for the bench.</p>
      <div className={`fc-table-wrap ${styles.wrap}`}>
        <table className="fc-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Lot</th>
              <th>Qty (g)</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((row) => (
              <tr key={`${row.sku}-${row.lot}`}>
                <td>{row.sku}</td>
                <td>{row.lot}</td>
                <td className={row.qtyG < 100 ? styles.low : undefined}>{row.qtyG}</td>
                <td>{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
