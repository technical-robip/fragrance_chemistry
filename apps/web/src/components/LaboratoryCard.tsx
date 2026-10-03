import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import styles from '../pages/AccountPage.module.css';

type Membership = {
  id: string;
  name: string;
  role: 'owner' | 'member';
  isPersonal: boolean;
  active: boolean;
};

type CurrentLab = {
  id: string;
  name: string;
  role: 'owner' | 'member';
  members: Array<{
    userId: string;
    role: 'owner' | 'member';
    displayName: string;
    email: string | null;
  }>;
  invites: Array<{ id: string; token: string; expiresAt: string }>;
};

export function LaboratoryCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const switchOrganization = useAuthStore((s) => s.switchOrganization);
  const [name, setName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const labs = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Membership[]>('/account/organizations'),
  });
  const current = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get<CurrentLab>('/account/organization'),
  });

  const rename = useMutation({
    mutationFn: () => api.patch('/account/organization', { name }),
    onSuccess: async () => {
      setNotice(t('laboratory.saved'));
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
  const invite = useMutation({
    mutationFn: () => api.post<{ token: string }>('/account/organization/invites', {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });

  async function onRename(event: FormEvent) {
    event.preventDefault();
    rename.mutate();
  }

  async function copyInvite(token: string) {
    const link = `${window.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(link);
    setNotice(t('laboratory.copied'));
  }

  async function removeMember(userId: string) {
    await api.delete(`/account/organization/members/${userId}`);
    await queryClient.invalidateQueries({ queryKey: ['organization'] });
  }

  async function revoke(id: string) {
    await api.delete(`/account/organization/invites/${id}`);
    await queryClient.invalidateQueries({ queryKey: ['organization'] });
  }

  const lab = current.data;
  const displayName = name ?? lab?.name ?? '';

  return (
    <section className={`fc-card ${styles.card}`}>
      <h2>{t('laboratory.title')}</h2>
      <p>{t('laboratory.hint')}</p>
      {(labs.data ?? []).length > 1 ? (
        <div className={styles.presets}>
          {(labs.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              className="fc-btn fc-btn--ghost"
              disabled={item.active}
              onClick={() =>
                void switchOrganization(item.id).then(() => queryClient.invalidateQueries())
              }
            >
              {item.active ? t('laboratory.active') : t('laboratory.switch')}: {item.name}
            </button>
          ))}
        </div>
      ) : null}
      {lab?.role === 'owner' ? (
        <form onSubmit={(event) => void onRename(event)}>
          <label>
            {t('laboratory.name')}
            <input value={displayName} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" className="fc-btn" disabled={rename.isPending}>
            {t('laboratory.save')}
          </button>
        </form>
      ) : (
        <p>{lab?.name}</p>
      )}
      <h3>{t('laboratory.members')}</h3>
      <ul className={styles.quotaList}>
        {(lab?.members ?? []).map((member) => (
          <li key={member.userId}>
            {member.displayName} ·{' '}
            {t(member.role === 'owner' ? 'laboratory.roleOwner' : 'laboratory.roleMember')}
            {lab?.role === 'owner' && member.role !== 'owner' ? (
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => void removeMember(member.userId)}
              >
                {t('laboratory.remove')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {lab?.role === 'owner' ? (
        <>
          <p>{t('laboratory.inviteHint')}</p>
          <button
            type="button"
            className="fc-btn"
            onClick={() => invite.mutate()}
            disabled={invite.isPending}
          >
            {t('laboratory.invite')}
          </button>
          <ul className={styles.quotaList}>
            {(lab.invites ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  onClick={() => void copyInvite(item.token)}
                >
                  {t('laboratory.copy')}
                </button>
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  onClick={() => void revoke(item.id)}
                >
                  {t('laboratory.revoke')}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {notice ? <p className={styles.ok}>{notice}</p> : null}
    </section>
  );
}
