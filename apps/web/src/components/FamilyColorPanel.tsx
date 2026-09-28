import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_FAMILY_COLORS, FAMILY_COLOR_KEYS, type FamilyColors } from '@fc/shared';
import { applyFamilyColors, resolvedFamilyColors } from '@/lib/apply-family-colors';
import { useAuthStore } from '@/stores/auth-store';
import styles from './FamilyColorPanel.module.css';

export function FamilyColorPanel() {
  const { t } = useTranslation();
  const familyColors = useAuthStore((s) => s.user?.familyColors);
  const updateAccount = useAuthStore((s) => s.updateAccount);
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<FamilyColors>(() => resolvedFamilyColors(familyColors));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setColors(resolvedFamilyColors(familyColors));
  }, [familyColors]);

  async function save(next: FamilyColors | null) {
    setBusy(true);
    try {
      await updateAccount({ familyColors: next });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className="fc-btn fc-btn--ghost"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('familyColors.edit')}
      </button>
      {open ? (
        <div className={styles.panel}>
          <p className={styles.hint}>{t('familyColors.hint')}</p>
          <ul className={styles.list}>
            {FAMILY_COLOR_KEYS.map((key) => (
              <li key={key}>
                <label className={styles.row}>
                  <span className={styles.swatch} style={{ background: colors[key] }} />
                  <span>{t(`families.${key}`)}</span>
                  <input
                    type="color"
                    value={colors[key]}
                    disabled={busy}
                    aria-label={t(`families.${key}`)}
                    onInput={(event) => {
                      const next = { ...colors, [key]: event.currentTarget.value };
                      setColors(next);
                      applyFamilyColors(next);
                    }}
                    onChange={(event) => {
                      const next = { ...colors, [key]: event.currentTarget.value };
                      setColors(next);
                      void save(next);
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            disabled={busy}
            onClick={() => {
              setColors({ ...DEFAULT_FAMILY_COLORS });
              applyFamilyColors(null);
              void save(null);
            }}
          >
            {t('familyColors.reset')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
