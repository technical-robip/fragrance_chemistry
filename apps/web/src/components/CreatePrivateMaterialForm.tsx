import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MATERIAL_KINDS,
  MATERIAL_ORIGINS,
  type CreateMaterialBody,
  type MaterialKind,
  type MaterialOrigin,
  type PyramidNote,
} from '@fc/shared';
import { api } from '@/lib/api-client';
import { type PickedMaterial } from '@/lib/catalog-index';
import { FcSelect } from './FcSelect';
import styles from './MaterialPicker.module.css';

const FAMILIES = [
  'Floral',
  'Fresh',
  'Green',
  'Animalic',
  'Woody',
  'Gourmand',
  'Special',
  'Amber',
  'Oriental',
] as const;

const NOTES: PyramidNote[] = ['top', 'middle', 'base', 'modifier'];

type AllergenRow = { key: string; name: string; percent: string };

type CreatedMaterial = PickedMaterial & {
  isPrivate?: boolean;
};

type Props = {
  initialName?: string;
  onCancel: () => void;
  onCreated: (material: PickedMaterial) => void;
};

function emptyAllergen(): AllergenRow {
  return { key: `${Date.now()}-${Math.random()}`, name: '', percent: '' };
}

export function CreatePrivateMaterialForm({ initialName = '', onCancel, onCreated }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<MaterialKind>('essential_oil');
  const [origin, setOrigin] = useState<MaterialOrigin>('natural');
  const [pyramidNote, setPyramidNote] = useState<PyramidNote>('middle');
  const [stockConcentrationPct, setStockConcentrationPct] = useState('100');
  const [solvent, setSolvent] = useState('');
  const [costPerGram, setCostPerGram] = useState('0');
  const [olfactoryFamily, setOlfactoryFamily] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [description, setDescription] = useState('');
  const [tenacityHours, setTenacityHours] = useState('');
  const [allergens, setAllergens] = useState<AllergenRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const conc = Number(stockConcentrationPct);
  const diluted = Number.isFinite(conc) && conc < 100;
  const hasAllergens = allergens.some((row) => row.name.trim() && Number(row.percent) > 0);

  const kindOptions = useMemo(
    () => MATERIAL_KINDS.map((kind) => ({ value: kind, label: t(`catalog.kinds.${kind}`) })),
    [t],
  );
  const originOptions = useMemo(
    () => MATERIAL_ORIGINS.map((item) => ({ value: item, label: t(`catalog.origins.${item}`) })),
    [t],
  );
  const noteOptions = useMemo(
    () =>
      NOTES.map((note) => ({
        value: note,
        label: t(
          note === 'middle'
            ? 'catalog.heart'
            : note === 'modifier'
              ? 'catalog.other'
              : `catalog.${note}`,
        ),
      })),
    [t],
  );
  const familyOptions = useMemo(
    () =>
      FAMILIES.map((family) => ({
        value: family,
        label: t(`families.${family}`, { defaultValue: family }),
      })),
    [t],
  );

  const body = useMemo((): CreateMaterialBody | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const stock = Number(stockConcentrationPct);
    const cost = Number(costPerGram);
    if (!Number.isFinite(stock) || stock <= 0 || stock > 100) return null;
    if (!Number.isFinite(cost) || cost < 0) return null;
    if (stock < 100 && !solvent.trim()) return null;

    const allergenProfile: Record<string, number> = {};
    for (const row of allergens) {
      const allergenName = row.name.trim();
      const pct = Number(row.percent);
      if (!allergenName || !Number.isFinite(pct) || pct <= 0) continue;
      allergenProfile[allergenName] = pct;
    }

    return {
      name: trimmed,
      category,
      origin,
      pyramidNote,
      stockConcentrationPct: stock,
      costPerGram: cost,
      solvent: solvent.trim() || undefined,
      casNumber: casNumber.trim() || undefined,
      olfactoryFamily: olfactoryFamily || undefined,
      manufacturer: manufacturer.trim() || undefined,
      description: description.trim() || undefined,
      tenacityHours: tenacityHours.trim() ? Number(tenacityHours) : undefined,
      allergenProfile: Object.keys(allergenProfile).length ? allergenProfile : undefined,
    };
  }, [
    allergens,
    casNumber,
    category,
    costPerGram,
    description,
    manufacturer,
    name,
    olfactoryFamily,
    origin,
    pyramidNote,
    solvent,
    stockConcentrationPct,
    tenacityHours,
  ]);

  const create = useMutation({
    mutationFn: (payload: CreateMaterialBody) =>
      api.post<CreatedMaterial>('/catalog/materials', payload),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['catalog', 'index'] });
      onCreated({
        id: created.id,
        name: created.name,
        manufacturer: created.manufacturer,
        olfactoryFamily: created.olfactoryFamily,
        pyramidNote: created.pyramidNote,
        costPerGram: created.costPerGram,
        casNumber: created.casNumber,
        imageUrl: created.imageUrl ?? null,
        isPrivate: true,
      });
    },
    onError: () => {
      setError(t('catalog.createFailed'));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body) {
      setError(t('catalog.createInvalid'));
      return;
    }
    create.mutate(body);
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.sectionLabel}>{t('catalog.requiredSection')}</p>
      <label className="fc-label" htmlFor="custom-material-name">
        {t('catalog.materialName')}
      </label>
      <input
        id="custom-material-name"
        className="fc-input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className={styles.formGrid}>
        <div>
          <label className="fc-label" htmlFor="custom-material-kind">
            {t('catalog.kind')}
          </label>
          <FcSelect
            inputId="custom-material-kind"
            options={kindOptions}
            value={category}
            onChange={(value) => {
              if (value) setCategory(value as MaterialKind);
            }}
            aria-label={t('catalog.kind')}
            platform="web"
          />
        </div>
        <div>
          <label className="fc-label" htmlFor="custom-material-origin">
            {t('catalog.origin')}
          </label>
          <FcSelect
            inputId="custom-material-origin"
            options={originOptions}
            value={origin}
            onChange={(value) => {
              if (value) setOrigin(value as MaterialOrigin);
            }}
            aria-label={t('catalog.origin')}
            platform="web"
          />
        </div>
      </div>

      <div className={styles.formGrid}>
        <div>
          <label className="fc-label" htmlFor="custom-material-note">
            {t('catalog.note')}
          </label>
          <FcSelect
            inputId="custom-material-note"
            options={noteOptions}
            value={pyramidNote}
            onChange={(value) => {
              if (value) setPyramidNote(value as PyramidNote);
            }}
            aria-label={t('catalog.note')}
            platform="web"
          />
        </div>
        <div>
          <label className="fc-label" htmlFor="custom-material-stock">
            {t('catalog.stockConcentration')}
          </label>
          <input
            id="custom-material-stock"
            className="fc-input"
            type="number"
            min={0.0001}
            max={100}
            step="any"
            value={stockConcentrationPct}
            onChange={(e) => setStockConcentrationPct(e.target.value)}
            required
          />
        </div>
      </div>

      {diluted ? (
        <>
          <label className="fc-label" htmlFor="custom-material-solvent">
            {t('catalog.solvent')}
          </label>
          <input
            id="custom-material-solvent"
            className="fc-input"
            value={solvent}
            onChange={(e) => setSolvent(e.target.value)}
            placeholder={t('catalog.solventPlaceholder')}
            required
          />
        </>
      ) : null}

      <label className="fc-label" htmlFor="custom-material-cost">
        {t('catalog.costPerGram')}
      </label>
      <input
        id="custom-material-cost"
        className="fc-input"
        type="number"
        min={0}
        step="any"
        value={costPerGram}
        onChange={(e) => setCostPerGram(e.target.value)}
      />

      <p className={styles.sectionLabel}>{t('catalog.optionalSection')}</p>

      <div className={styles.formGrid}>
        <div>
          <label className="fc-label" htmlFor="custom-material-family">
            {t('catalog.family')}
          </label>
          <FcSelect
            inputId="custom-material-family"
            options={familyOptions}
            value={olfactoryFamily || null}
            onChange={(value) => setOlfactoryFamily(value ?? '')}
            isClearable
            placeholder={t('catalog.familyUnset')}
            aria-label={t('catalog.family')}
            platform="web"
          />
        </div>
        <div>
          <label className="fc-label" htmlFor="custom-material-cas">
            {t('catalog.casNumber')}
          </label>
          <input
            id="custom-material-cas"
            className="fc-input"
            value={casNumber}
            onChange={(e) => setCasNumber(e.target.value)}
          />
        </div>
      </div>

      <label className="fc-label" htmlFor="custom-material-source">
        {t('catalog.source')}
      </label>
      <input
        id="custom-material-source"
        className="fc-input"
        value={manufacturer}
        onChange={(e) => setManufacturer(e.target.value)}
        placeholder={t('catalog.sourcePlaceholder')}
      />

      <label className="fc-label" htmlFor="custom-material-tenacity">
        {t('catalog.tenacity')}
      </label>
      <input
        id="custom-material-tenacity"
        className="fc-input"
        type="number"
        min={0}
        step="any"
        value={tenacityHours}
        onChange={(e) => setTenacityHours(e.target.value)}
      />

      <label className="fc-label" htmlFor="custom-material-description">
        {t('catalog.description')}
      </label>
      <textarea
        id="custom-material-description"
        className={`fc-input ${styles.textarea}`}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <p className={styles.sectionLabel}>{t('catalog.allergens')}</p>
      {!hasAllergens ? <p className={styles.warning}>{t('catalog.ifraWarning')}</p> : null}
      {allergens.map((row) => (
        <div key={row.key} className={styles.allergenRow}>
          <input
            className="fc-input"
            placeholder={t('catalog.allergenName')}
            value={row.name}
            onChange={(e) =>
              setAllergens((prev) =>
                prev.map((item) =>
                  item.key === row.key ? { ...item, name: e.target.value } : item,
                ),
              )
            }
          />
          <input
            className="fc-input"
            type="number"
            min={0}
            max={100}
            step="any"
            placeholder={t('catalog.allergenPercent')}
            value={row.percent}
            onChange={(e) =>
              setAllergens((prev) =>
                prev.map((item) =>
                  item.key === row.key ? { ...item, percent: e.target.value } : item,
                ),
              )
            }
          />
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            onClick={() => setAllergens((prev) => prev.filter((item) => item.key !== row.key))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="fc-btn fc-btn--ghost"
        onClick={() => setAllergens((prev) => [...prev, emptyAllergen()])}
      >
        {t('catalog.addAllergen')}
      </button>

      {error ? <p className={styles.warning}>{error}</p> : null}

      <div className={styles.formActions}>
        <button type="button" className="fc-btn fc-btn--ghost" onClick={onCancel}>
          {t('catalog.cancel')}
        </button>
        <button
          type="submit"
          className="fc-btn fc-btn--primary"
          disabled={create.isPending || !body}
        >
          {create.isPending ? t('catalog.creating') : t('catalog.saveMaterial')}
        </button>
      </div>
    </form>
  );
}
