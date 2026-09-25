import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { downloadBinary } from '@/lib/formula-export';
import { FcCheckbox } from '@/components/FcCheckbox';
import { type FormulaSummary } from '@/components/FormulaSelector';
import styles from './FormulaExcelExportDialog.module.css';

type Mode = 'current' | 'selected' | 'all';

type Props = {
  open: boolean;
  onClose: () => void;
  currentFormulaId?: string | null;
  currentFormulaName?: string | null;
  onExported?: (message: string) => void;
};

export function FormulaExcelExportDialog({
  open,
  onClose,
  currentFormulaId,
  currentFormulaName,
  onExported,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('current');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: formulas = [], isLoading } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    const next = new Set<string>();
    if (currentFormulaId) next.add(currentFormulaId);
    setSelected(next);
    setMode(currentFormulaId ? 'current' : formulas.length ? 'all' : 'selected');
  }, [open, currentFormulaId, formulas.length]);

  const current = useMemo(
    () => formulas.find((f) => f.id === currentFormulaId) ?? null,
    [formulas, currentFormulaId],
  );
  const currentName = currentFormulaName || current?.name;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download() {
    setError(null);
    if (formulas.length === 0) {
      setError(t('formulaExport.empty'));
      return;
    }
    if (mode === 'current' && !currentFormulaId) {
      setError(t('formulaExport.thisFormulaEmpty'));
      return;
    }
    if (mode === 'selected' && selected.size === 0) {
      setError(t('formulaExport.noneSelected'));
      return;
    }

    const body =
      mode === 'all'
        ? { all: true }
        : {
            formulaIds: mode === 'current' && currentFormulaId ? [currentFormulaId] : [...selected],
          };

    setBusy(true);
    try {
      const file = await api.postBlob('/formulas/export', body);
      downloadBinary(file.filename, file.mime, file.blob);
      onExported?.(t('formulaExport.done'));
      onClose();
    } catch {
      setError(t('formulaExport.failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-excel-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="formula-excel-export-title">{t('formulaExport.title')}</h2>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            onClick={onClose}
            aria-label={t('formulaExport.cancel')}
          >
            ✕
          </button>
        </header>

        {isLoading ? <p className={styles.hint}>{t('common.loading')}</p> : null}

        <fieldset className={styles.modes} disabled={busy}>
          <label className={styles.mode}>
            <input
              type="radio"
              name="formula-export-mode"
              value="current"
              checked={mode === 'current'}
              disabled={!currentFormulaId}
              onChange={() => setMode('current')}
            />
            <span>
              {currentName
                ? t('formulaExport.thisFormulaNamed', { name: currentName })
                : t('formulaExport.thisFormula')}
            </span>
          </label>
          <label className={styles.mode}>
            <input
              type="radio"
              name="formula-export-mode"
              value="selected"
              checked={mode === 'selected'}
              onChange={() => setMode('selected')}
            />
            <span>{t('formulaExport.selected')}</span>
          </label>
          <label className={styles.mode}>
            <input
              type="radio"
              name="formula-export-mode"
              value="all"
              checked={mode === 'all'}
              disabled={formulas.length === 0}
              onChange={() => setMode('all')}
            />
            <span>{t('formulaExport.all', { count: formulas.length })}</span>
          </label>
        </fieldset>

        {mode === 'selected' ? (
          <ul className={styles.list}>
            {formulas.map((formula) => (
              <li key={formula.id}>
                <FcCheckbox
                  size="sm"
                  checked={selected.has(formula.id)}
                  onChange={() => toggle(formula.id)}
                  label={`${formula.name} (${formula.status})`}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <footer className={styles.actions}>
          <button type="button" className="fc-btn fc-btn--ghost" onClick={onClose} disabled={busy}>
            {t('formulaExport.cancel')}
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--amber"
            onClick={() => void download()}
            disabled={busy}
          >
            {busy ? t('formulaExport.busy') : t('formulaExport.download')}
          </button>
        </footer>
      </div>
    </div>
  );
}
