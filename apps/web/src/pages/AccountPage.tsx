import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  juiceClassFromConcentration,
  type FeatureKey,
  type NotificationPreferences,
  type QuotaKey,
} from '@fc/shared';
import { FEATURE_KEYS, QUOTA_KEYS } from '@fc/shared';
import { ApiError, api } from '@/lib/api-client';
import { useAuthStore, userHasFeature } from '@/stores/auth-store';
import { APP_LOCALES, useUiStore, type AppLocale, type ThemeMode } from '@/stores/ui-store';
import { LocaleFlag } from '@/components/icons/flags';
import { FcCheckbox } from '@/components/FcCheckbox';
import { FcSelect } from '@/components/FcSelect';
import styles from './AccountPage.module.css';

type AccountPayload = {
  user: {
    displayName: string;
    email: string;
    role: string;
    plan: string;
    createdAt: string;
    locale: string;
    theme: string;
    defaultBatchTargetGrams: number;
    defaultConcentrationPct: number;
    defaultIfraCategory: number;
    entitlements: {
      plan: { name: string; slug: string };
      subscription: { status: string; startsAt: string; endsAt: string | null } | null;
      features: FeatureKey[];
      quotas: Record<QuotaKey, number | null>;
      usage: Record<QuotaKey, number>;
    };
  };
  lab: {
    formulaCount: number;
    evaluationCount: number;
    lowStockItems: number;
    weighingSessionCount: number;
  };
  billing: { enabled: boolean; plan: string; planName: string; message: string };
};

const IFRA_CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const BATCH_PRESETS = [10, 50, 100] as const;
const JUICE_PRESETS = [
  { id: 'edt' as const, pct: 10, labelKey: 'dashboard.juiceClassEdt' },
  { id: 'edp' as const, pct: 17, labelKey: 'dashboard.juiceClassEdp' },
  { id: 'extrait' as const, pct: 25, labelKey: 'dashboard.juiceClassExtrait' },
];
const SNAPSHOT_LINKS: Array<{
  to: string;
  feature: FeatureKey;
  countKey: 'formulas' | 'evaluations' | 'lowStock' | 'weighingSessions';
  field: keyof AccountPayload['lab'];
}> = [
  { to: '/workbench', feature: 'workbench', countKey: 'formulas', field: 'formulaCount' },
  { to: '/evaluation', feature: 'evaluation', countKey: 'evaluations', field: 'evaluationCount' },
  { to: '/inventory', feature: 'inventory', countKey: 'lowStock', field: 'lowStockItems' },
  {
    to: '/weighing',
    feature: 'weighing',
    countKey: 'weighingSessions',
    field: 'weighingSessionCount',
  },
];

function canSelfAssignRole(role?: string) {
  return role === 'enthusiast' || role === 'perfumer';
}

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const storeUser = useAuthStore((s) => s.user);
  const updateAccount = useAuthStore((s) => s.updateAccount);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const uiTheme = useUiStore((s) => s.theme);
  const uiLocale = useUiStore((s) => s.locale);
  const setTheme = useUiStore((s) => s.setTheme);
  const setLocale = useUiStore((s) => s.setLocale);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['account'],
    queryFn: () => api.get<AccountPayload>('/account'),
  });

  const reminders = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get<NotificationPreferences>('/notification-preferences'),
    enabled: userHasFeature(storeUser, 'evaluation'),
  });

  const user = data?.user;
  const selfAssignable = canSelfAssignRole(storeUser?.role ?? user?.role);
  const [identity, setIdentity] = useState({
    displayName: '',
    email: '',
    role: 'enthusiast',
  });
  const [lab, setLab] = useState({
    defaultBatchTargetGrams: 10,
    defaultConcentrationPct: 20,
    defaultIfraCategory: 4,
  });
  const [hydratedForm, setHydratedForm] = useState(false);
  const [identityMsg, setIdentityMsg] = useState<string | null>(null);
  const [labMsg, setLabMsg] = useState<string | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    if (!user || hydratedForm) return;
    setIdentity({
      displayName: user.displayName,
      email: user.email,
      role: user.role === 'perfumer' || storeUser?.role === 'perfumer' ? 'perfumer' : 'enthusiast',
    });
    setLab({
      defaultBatchTargetGrams: user.defaultBatchTargetGrams,
      defaultConcentrationPct: user.defaultConcentrationPct,
      defaultIfraCategory: user.defaultIfraCategory,
    });
    setHydratedForm(true);
  }, [user, hydratedForm]);

  const quotaRows = useMemo(() => {
    if (!user) return [];
    return QUOTA_KEYS.map((key) => ({
      key,
      used: user.entitlements.usage[key] ?? 0,
      limit: user.entitlements.quotas[key],
    }));
  }, [user]);

  const juiceClass = juiceClassFromConcentration(lab.defaultConcentrationPct);
  const periodStart = formatWhen(user?.entitlements.subscription?.startsAt);
  const periodEnd = formatWhen(user?.entitlements.subscription?.endsAt);

  async function saveIdentity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIdentityMsg(null);
    try {
      await updateAccount({
        displayName: identity.displayName,
        email: identity.email,
        ...(selfAssignable ? { role: identity.role } : {}),
      });
      await refetch();
      setIdentityMsg(t('account.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    }
  }

  async function saveLab(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLabMsg(null);
    try {
      await updateAccount(lab);
      await refetch();
      setLabMsg(t('account.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    }
  }

  async function persistPrefs(patch: { theme?: ThemeMode; locale?: AppLocale }) {
    setError(null);
    setPrefsMsg(null);
    setPrefsBusy(true);
    try {
      if (patch.theme) setTheme(patch.theme);
      if (patch.locale) {
        setLocale(patch.locale);
        void i18n.changeLanguage(patch.locale);
      }
      await updateAccount(patch);
      await refetch();
      setPrefsMsg(t('account.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    } finally {
      setPrefsBusy(false);
    }
  }

  async function toggleReminders(enabled: boolean) {
    setPrefsBusy(true);
    setError(null);
    setPrefsMsg(null);
    try {
      await api.patch('/notification-preferences', { evaluationEnabled: enabled });
      await qc.invalidateQueries({ queryKey: ['notification-preferences'] });
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      setPrefsMsg(t('account.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    } finally {
      setPrefsBusy(false);
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setError(t('account.passwordMismatch'));
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg(t('account.passwordChanged'));
    } catch (err) {
      setError(err instanceof ApiError ? t('account.passwordFailed') : t('auth.unreachable'));
    }
  }

  async function onLogoutAll() {
    if (!window.confirm(t('account.signOutAllConfirm'))) return;
    await logoutAll();
  }

  const roleLabel =
    storeUser?.role === 'admin'
      ? t('account.roleAdmin')
      : storeUser?.role === 'supplier'
        ? t('account.roleSupplier')
        : storeUser?.role === 'perfumer'
          ? t('account.rolePerfumer')
          : t('account.roleEnthusiast');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className="fc-page-title">{t('account.title')}</h1>
          <p className="fc-muted">{t('account.subtitle')}</p>
        </div>
      </header>

      {isLoading ? <p className="fc-muted">{t('common.loading')}</p> : null}
      {isError ? <p className="fc-muted">{t('account.loadFailed')}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {user ? (
        <div className={styles.grid}>
          <form className={`fc-card ${styles.card}`} onSubmit={(e) => void saveIdentity(e)}>
            <h2>{t('account.identity')}</h2>
            <label className="fc-label" htmlFor="account-display-name">
              {t('auth.displayName')}
            </label>
            <input
              id="account-display-name"
              className="fc-input"
              value={identity.displayName}
              onChange={(e) => setIdentity((s) => ({ ...s, displayName: e.target.value }))}
            />
            <label className="fc-label" htmlFor="account-email">
              {t('auth.email')}
            </label>
            <input
              id="account-email"
              className="fc-input"
              type="email"
              value={identity.email}
              onChange={(e) => setIdentity((s) => ({ ...s, email: e.target.value }))}
            />
            {selfAssignable ? (
              <>
                <label className="fc-label" htmlFor="account-role">
                  {t('account.role')}
                </label>
                <FcSelect
                  inputId="account-role"
                  aria-label={t('account.role')}
                  options={[
                    { value: 'enthusiast', label: t('account.roleEnthusiast') },
                    { value: 'perfumer', label: t('account.rolePerfumer') },
                  ]}
                  value={identity.role}
                  onChange={(v) => v && setIdentity((s) => ({ ...s, role: v }))}
                  platform="web"
                />
                <p className="fc-muted">{t('account.roleHint')}</p>
              </>
            ) : (
              <p>
                {t('account.role')}: <strong>{roleLabel}</strong>
                <span className="fc-muted"> — {t('account.roleLocked')}</span>
              </p>
            )}
            <p className="fc-muted">
              {t('account.memberSince', {
                date: new Date(user.createdAt).toLocaleDateString(),
              })}
            </p>
            <button type="submit" className="fc-btn fc-btn--primary">
              {t('account.saveIdentity')}
            </button>
            {identityMsg ? <p className={styles.ok}>{identityMsg}</p> : null}
          </form>

          <form className={`fc-card ${styles.card}`} onSubmit={(e) => void saveLab(e)}>
            <h2>{t('account.labDefaults')}</h2>
            <p className="fc-muted">{t('account.labDefaultsHint')}</p>
            <label className="fc-label" htmlFor="account-batch">
              {t('account.batchGrams')}
            </label>
            <input
              id="account-batch"
              className="fc-input"
              type="number"
              min={0.001}
              step="any"
              value={lab.defaultBatchTargetGrams}
              onChange={(e) =>
                setLab((s) => ({ ...s, defaultBatchTargetGrams: Number(e.target.value) }))
              }
            />
            <div className={styles.presets} role="group" aria-label={t('account.batchGrams')}>
              {BATCH_PRESETS.map((grams) => (
                <button
                  key={grams}
                  type="button"
                  className={
                    lab.defaultBatchTargetGrams === grams ? styles.presetOn : styles.preset
                  }
                  onClick={() => setLab((s) => ({ ...s, defaultBatchTargetGrams: grams }))}
                >
                  {grams} g
                </button>
              ))}
            </div>
            <label className="fc-label" htmlFor="account-concentration">
              {t('account.concentration')}
            </label>
            <input
              id="account-concentration"
              className="fc-input"
              type="number"
              min={0.1}
              max={100}
              step="any"
              value={lab.defaultConcentrationPct}
              onChange={(e) =>
                setLab((s) => ({ ...s, defaultConcentrationPct: Number(e.target.value) }))
              }
            />
            <div className={styles.presets} role="group" aria-label={t('account.concentration')}>
              {JUICE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={juiceClass === preset.id ? styles.presetOn : styles.preset}
                  onClick={() => setLab((s) => ({ ...s, defaultConcentrationPct: preset.pct }))}
                >
                  {t(preset.labelKey)} · {preset.pct}%
                </button>
              ))}
            </div>
            <label className="fc-label" htmlFor="account-ifra">
              {t('account.ifraCategory')}
            </label>
            <FcSelect
              inputId="account-ifra"
              aria-label={t('account.ifraCategory')}
              isSearchable
              options={IFRA_CATEGORIES.map((n) => ({
                value: String(n),
                label: `${n} — ${t(`account.ifraCategories.${n}`)}`,
              }))}
              value={String(lab.defaultIfraCategory)}
              onChange={(v) => v && setLab((s) => ({ ...s, defaultIfraCategory: Number(v) }))}
              platform="web"
            />
            <button type="submit" className="fc-btn fc-btn--primary">
              {t('account.saveLab')}
            </button>
            {labMsg ? <p className={styles.ok}>{labMsg}</p> : null}
          </form>

          <section className={`fc-card ${styles.card}`}>
            <h2>{t('account.preferences')}</h2>
            <p className="fc-muted">{t('account.preferencesHint')}</p>
            <fieldset className={styles.fieldset}>
              <legend>{t('common.themeToggle')}</legend>
              <div className={styles.presets}>
                {(['dark', 'light'] as ThemeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={prefsBusy}
                    className={uiTheme === mode ? styles.presetOn : styles.preset}
                    onClick={() => void persistPrefs({ theme: mode })}
                  >
                    {mode === 'dark' ? t('common.themeDark') : t('common.themeLight')}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="fc-label" htmlFor="account-locale">
              {t('common.language')}
            </label>
            <div className={styles.localeRow}>
              <LocaleFlag locale={uiLocale} />
              <FcSelect
                inputId="account-locale"
                aria-label={t('common.language')}
                className={styles.grow}
                isDisabled={prefsBusy}
                options={APP_LOCALES.map((code) => ({
                  value: code,
                  label: t(`common.locales.${code}`),
                }))}
                value={uiLocale}
                onChange={(v) => v && void persistPrefs({ locale: v as AppLocale })}
                platform="web"
              />
            </div>
            {userHasFeature(storeUser, 'evaluation') ? (
              <div className={styles.reminders}>
                <FcCheckbox
                  data-testid="evaluation-reminders-toggle"
                  checked={reminders.data?.evaluationEnabled ?? true}
                  disabled={prefsBusy || reminders.isLoading}
                  label={t('account.evaluationReminders')}
                  onChange={(event) => void toggleReminders(event.target.checked)}
                />
                <p className="fc-muted">{t('account.evaluationRemindersHint')}</p>
              </div>
            ) : null}
            {prefsMsg ? <p className={styles.ok}>{prefsMsg}</p> : null}
          </section>

          <section className={`fc-card ${styles.card}`}>
            <h2>{t('account.subscription')}</h2>
            <p>
              <strong>{user.entitlements.plan.name}</strong> ({user.entitlements.plan.slug})
            </p>
            <p className="fc-muted">
              {user.entitlements.subscription?.status ?? 'active'}
              {periodStart ? ` · ${periodStart}` : ''}
              {periodEnd ? ` → ${periodEnd}` : ''}
            </p>
            <p className="fc-muted">{t('account.subscriptionManaged')}</p>
            <ul className={styles.quotaList}>
              {quotaRows.map((row) => (
                <li key={row.key}>
                  {t(`account.quotas.${row.key}`)}:{' '}
                  {row.limit == null
                    ? t('account.unlimited', { used: row.used })
                    : t('account.quotaUsed', { used: row.used, limit: row.limit })}
                </li>
              ))}
            </ul>
            <div className={styles.features}>
              {FEATURE_KEYS.map((key) => (
                <span
                  key={key}
                  className={
                    user.entitlements.features.includes(key) ? styles.featureOn : styles.featureOff
                  }
                >
                  {t(`account.features.${key}`)}
                </span>
              ))}
            </div>
          </section>

          <section className={`fc-card ${styles.card}`}>
            <h2>{t('account.labSnapshot')}</h2>
            <div className={styles.stats}>
              {SNAPSHOT_LINKS.filter((item) => userHasFeature(storeUser, item.feature)).map(
                (item) => (
                  <Link key={item.to} to={item.to}>
                    {t(`account.${item.countKey}`, { count: data?.lab[item.field] ?? 0 })}
                  </Link>
                ),
              )}
            </div>
          </section>

          <form className={`fc-card ${styles.card}`} onSubmit={(e) => void onPassword(e)}>
            <h2>{t('account.security')}</h2>
            <label className="fc-label" htmlFor="account-current-password">
              {t('account.currentPassword')}
            </label>
            <input
              id="account-current-password"
              className="fc-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <label className="fc-label" htmlFor="account-new-password">
              {t('account.newPassword')}
            </label>
            <input
              id="account-new-password"
              className="fc-input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <label className="fc-label" htmlFor="account-confirm-password">
              {t('account.confirmPassword')}
            </label>
            <input
              id="account-confirm-password"
              className="fc-input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div className={styles.actions}>
              <button
                type="submit"
                className="fc-btn fc-btn--primary"
                disabled={
                  !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword
                }
              >
                {t('account.changePassword')}
              </button>
              <button type="button" className="fc-btn fc-btn--ghost" onClick={() => void logout()}>
                {t('common.signOut')}
              </button>
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => void onLogoutAll()}
              >
                {t('account.signOutAll')}
              </button>
            </div>
            {passwordMsg ? <p className={styles.ok}>{passwordMsg}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
