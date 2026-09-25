/** Client-side formula table exports (CSV + SpreadsheetML .xls). */

export type FormulaExportRow = {
  materialName: string;
  percent: number;
  amount: number;
  unit: string;
};

export type FormulaExportPayload = {
  name: string;
  concentrationPct: number;
  batchGrams: number;
  rows: FormulaExportRow[];
  totalPercent: number;
};

function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadBinary(filename: string, mime: string, data: Blob | ArrayBuffer | string) {
  downloadBlob(filename, mime, data);
}

function safeFilename(name: string, ext: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'formula'}.${ext}`;
}

function csvEscape(value: string | number) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportFormulaCsv(payload: FormulaExportPayload) {
  const lines = [
    ['Material', 'Percent', 'Amount', 'Unit'].map(csvEscape).join(','),
    ...payload.rows.map((r) =>
      [r.materialName, r.percent.toFixed(4), r.amount.toFixed(4), r.unit].map(csvEscape).join(','),
    ),
    ['Total', payload.totalPercent.toFixed(4), '', ''].map(csvEscape).join(','),
    '',
    ['Formula', payload.name].map(csvEscape).join(','),
    ['Concentration %', payload.concentrationPct].map(csvEscape).join(','),
    ['Batch g', payload.batchGrams].map(csvEscape).join(','),
  ];
  downloadBlob(
    safeFilename(payload.name, 'csv'),
    'text/csv;charset=utf-8',
    `\uFEFF${lines.join('\n')}`,
  );
}

function xmlEscape(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** SpreadsheetML workbook — opens in Excel / Numbers without a heavy dependency. */
export function exportFormulaXls(payload: FormulaExportPayload) {
  const header = ['Material', 'Percent', 'Amount', 'Unit'];
  const dataRows = payload.rows.map((r) => [
    r.materialName,
    r.percent.toFixed(4),
    r.amount.toFixed(4),
    r.unit,
  ]);
  dataRows.push(['Total', payload.totalPercent.toFixed(4), '', '']);
  dataRows.push([]);
  dataRows.push(['Formula', payload.name, '', '']);
  dataRows.push(['Concentration %', String(payload.concentrationPct), '', '']);
  dataRows.push(['Batch g', String(payload.batchGrams), '', '']);

  const all = [header, ...dataRows];
  const rowsXml = all
    .map(
      (cells) =>
        `<Row>${cells
          .map((c) => {
            const isNum = c !== '' && !Number.isNaN(Number(c)) && /^-?\d+(\.\d+)?$/.test(c);
            return isNum
              ? `<Cell><Data ss:Type="Number">${xmlEscape(c)}</Data></Cell>`
              : `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`;
          })
          .join('')}</Row>`,
    )
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Formula">
  <Table>${rowsXml}</Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(safeFilename(payload.name, 'xls'), 'application/vnd.ms-excel;charset=utf-8', xml);
}
