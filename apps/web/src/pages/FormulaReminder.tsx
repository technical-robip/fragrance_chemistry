import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { announceReminder, BellIcon } from '@/components/layout/NotificationBell';
import { api } from '@/lib/api-client';
import styles from './FormulaReminder.module.css';

export function FormulaReminder({
  formulaId,
  formulaName,
}: {
  formulaId: string;
  formulaName: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [swing, setSwing] = useState(0);

  const formulaReminders = useQuery({
    queryKey: ['notification-mute', formulaId],
    queryFn: () =>
      api.get<{ formulaId: string; muted: boolean }>(`/formulas/${formulaId}/notification-mute`),
  });

  const setFormulaReminders = useMutation({
    mutationFn: (muted: boolean) => api.put(`/formulas/${formulaId}/notification-mute`, { muted }),
    onSuccess: async (_data, muted) => {
      const name = formulaName.trim() || t('evaluation.thisFormula');
      const message = t(
        muted ? 'evaluation.formulaRemindersOff' : 'evaluation.formulaRemindersOn',
        {
          name,
        },
      );
      setNotice(message);
      setSwing((value) => value + 1);
      announceReminder(message);
      await qc.invalidateQueries({ queryKey: ['notification-mute', formulaId] });
      await qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const on = !(formulaReminders.data?.muted ?? false);
  const pending = formulaReminders.isLoading || setFormulaReminders.isPending;

  return (
    <div className={styles.band}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid="formula-reminder-toggle"
        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
        disabled={pending}
        onClick={() => setFormulaReminders.mutate(on)}
      >
        <span
          key={swing}
          className={`${styles.bell} ${on ? styles.bellOn : styles.bellOff} ${swing > 0 ? styles.bellSwing : ''}`}
          aria-hidden
        >
          <BellIcon className={styles.icon} />
        </span>
        <span className={styles.copy}>
          <span className={styles.title}>{t('evaluation.formulaReminders')}</span>
          <span className={styles.hint}>{t('evaluation.formulaRemindersHint')}</span>
        </span>
      </button>
      <p
        className={`${styles.status} ${notice ? styles.statusOn : ''}`}
        role="status"
        aria-live="polite"
        data-testid="formula-reminder-status"
      >
        {notice ?? ''}
      </p>
    </div>
  );
}
