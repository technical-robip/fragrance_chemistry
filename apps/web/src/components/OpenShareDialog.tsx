import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import styles from './OpenShareDialog.module.css';

type Status = {
  state: 'unpublished' | 'published' | 'withdrawn';
  token: string | null;
  stale?: boolean;
};

type Props = {
  formulaId: string;
  formulaName: string;
  onClose: () => void;
};

export function OpenShareDialog({ formulaId, formulaName, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'publish' | 'withdraw' | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['formula-publication', formulaId],
    queryFn: () => api.get<Status>(`/formulas/${formulaId}/publication`),
  });

  const publish = useMutation({
    mutationFn: () => api.post<Status>(`/formulas/${formulaId}/publication`, {}),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['formula-publication', formulaId] });
    },
  });
  const withdraw = useMutation({
    mutationFn: () => api.delete<Status>(`/formulas/${formulaId}/publication`),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['formula-publication', formulaId] });
    },
  });

  const link = data?.token ? `${window.location.origin}/open/${data.token}` : '';

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={`fc-card ${styles.dialog}`}
        role="dialog"
        aria-labelledby="open-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="open-share-title">{t('openFormula.shareTitle', { name: formulaName })}</h2>
        <p>{t('openFormula.shareBody')}</p>
        {isLoading ? <p>{t('common.loading')}</p> : null}
        {data?.state === 'published' && data.stale ? <p>{t('openFormula.staleBanner')}</p> : null}
        {data?.token && data.state !== 'unpublished' ? (
          <p className={styles.link}>
            <a href={link}>{link}</a>
          </p>
        ) : null}
        {confirming === 'publish' ? <p>{t('openFormula.publishConfirm')}</p> : null}
        {confirming === 'withdraw' ? <p>{t('openFormula.withdrawConfirm')}</p> : null}
        <div className={styles.actions}>
          {data?.state === 'published' ? (
            <>
              <button type="button" className="fc-btn" onClick={() => void copyLink()}>
                {copied ? t('openFormula.copied') : t('openFormula.copyLink')}
              </button>
              <button
                type="button"
                className="fc-btn"
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
              >
                {t('openFormula.republish')}
              </button>
              {confirming === 'withdraw' ? (
                <button
                  type="button"
                  className="fc-btn fc-btn--amber"
                  onClick={() => withdraw.mutate()}
                  disabled={withdraw.isPending}
                >
                  {t('openFormula.withdrawNow')}
                </button>
              ) : (
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  onClick={() => setConfirming('withdraw')}
                >
                  {t('openFormula.withdraw')}
                </button>
              )}
            </>
          ) : confirming === 'publish' ? (
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
            >
              {t('openFormula.publishNow')}
            </button>
          ) : (
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={() => setConfirming('publish')}
            >
              {t('openFormula.shareOpen')}
            </button>
          )}
          <button type="button" className="fc-btn fc-btn--ghost" onClick={onClose}>
            {t('openFormula.close')}
          </button>
        </div>
        {publish.isError || withdraw.isError ? <p>{t('openFormula.shareFailed')}</p> : null}
      </div>
    </div>
  );
}
