export type PublishedLine = {
  materialId: string;
  materialName: string;
  percent: number;
  pyramidNote: string | null;
  solvent: string | null;
  stockConcentrationPct: number | null;
  sortOrder: number;
};

export type PublishedSnapshot = {
  name: string;
  description: string | null;
  lines: PublishedLine[];
};

export type PublicationRecord = {
  token: string;
  status: string;
  snapshot: PublishedSnapshot | null;
  publishedAt: string | null;
  authorName: string | null;
  stale: boolean;
};

export type OpenFormulaView =
  | {
      state: 'withdrawn';
      canRepublish: boolean;
    }
  | {
      state: 'published';
      token: string;
      name: string;
      description: string | null;
      authorName: string | null;
      publishedAt: string | null;
      stale: boolean;
      lines: PublishedLine[];
      canRepublish: boolean;
    };

/** Public readers see a recipe only while it is published. Withdrawal keeps the token and drops the snapshot. */
export function openFormulaView(record: PublicationRecord, canRepublish: boolean): OpenFormulaView {
  if (record.status !== 'published' || !record.snapshot) {
    return { state: 'withdrawn', canRepublish };
  }
  return {
    state: 'published',
    token: record.token,
    name: record.snapshot.name,
    description: record.snapshot.description,
    authorName: record.authorName,
    publishedAt: record.publishedAt,
    stale: record.stale,
    lines: record.snapshot.lines,
    canRepublish,
  };
}
