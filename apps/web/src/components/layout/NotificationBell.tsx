import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotificationInbox } from '@fc/shared';
import { api } from '@/lib/api-client';
import styles from './NotificationBell.module.css';

type Placement = 'up' | 'down';

function hrefFor(item: NotificationInbox['items'][number]) {
  const params = new URLSearchParams(item.deepLink.query);
  const query = params.toString();
  return query ? `${item.deepLink.path}?${query}` : item.deepLink.path;
}

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M6 9.5a6 6 0 1 1 12 0c0 4.2 1.4 5.8 1.4 5.8H4.6S6 13.7 6 9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 18.2a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function announceReminder(message: string) {
  window.dispatchEvent(new CustomEvent('fc-reminder-confirm', { detail: { message } }));
}

let confirmClaim = 0;

export function NotificationBell({ placement = 'down' }: { placement?: Placement }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [ack, setAck] = useState(0);
  const [anchor, setAnchor] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(352, window.innerWidth - 16);
    const preferred = placement === 'up' ? rect.right + 8 : rect.left;
    const left = Math.min(Math.max(8, preferred), window.innerWidth - width - 8);
    if (placement === 'down') setAnchor({ top: rect.bottom + 6, left, width });
    else setAnchor({ bottom: window.innerHeight - rect.top + 6, left, width });
  }

  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationInbox>('/notifications'),
    refetchInterval: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const mute = useMutation({
    mutationFn: (formulaId: string) =>
      api.put(`/formulas/${formulaId}/notification-mute`, { muted: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notification-mute'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    place();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    const onConfirm = (event: Event) => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;
      if (!visible) return;
      const message = (event as CustomEvent<{ message: string }>).detail?.message;
      if (!message) return;
      const ticket = ++confirmClaim;
      window.setTimeout(() => {
        if (ticket !== confirmClaim) return;
        setConfirm(message);
        setAck((value) => value + 1);
        place();
        window.setTimeout(() => {
          if (ticket !== confirmClaim) return;
          setConfirm(null);
        }, 4200);
      }, 0);
    };
    window.addEventListener('fc-reminder-confirm', onConfirm);
    return () => window.removeEventListener('fc-reminder-confirm', onConfirm);
  }, []);

  const unread = inbox.data?.unreadCount ?? 0;
  const items = inbox.data?.items ?? [];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        ref={buttonRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('notifications.bell')}
        data-testid="notification-bell"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void inbox.refetch();
        }}
      >
        <BellIcon key={ack} className={`${styles.icon} ${ack > 0 ? styles.iconSwing : ''}`} />
        {unread > 0 ? (
          <span className={styles.badge} data-testid="notification-count">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {confirm && !open && anchor
        ? createPortal(
            <div
              className={styles.confirm}
              role="status"
              data-testid="notification-confirm"
              style={{
                position: 'fixed',
                top: anchor.top,
                bottom: anchor.bottom,
                left: anchor.left,
                width: Math.min(280, anchor.width),
                zIndex: 80,
              }}
            >
              {confirm}
            </div>,
            document.body,
          )
        : null}
      {open && anchor
        ? createPortal(
            <div
              id={panelId}
              ref={panelRef}
              className={styles.panel}
              role="region"
              aria-label={t('notifications.bell')}
              data-testid="notification-panel"
              style={{
                position: 'fixed',
                top: anchor.top,
                bottom: anchor.bottom,
                left: anchor.left,
                width: anchor.width,
                zIndex: 80,
              }}
            >
              {confirm ? (
                <p
                  className={styles.confirmInline}
                  role="status"
                  data-testid="notification-confirm"
                >
                  {confirm}
                </p>
              ) : null}
              {items.length === 0 ? (
                <p className={styles.empty}>{t('notifications.empty')}</p>
              ) : (
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={item.unread ? styles.itemUnread : styles.item}
                      data-testid={`notification-item-${item.checkpointKey}`}
                    >
                      <Link
                        to={hrefFor(item)}
                        className={styles.link}
                        data-testid={`notification-link-${item.checkpointKey}`}
                        onClick={() => {
                          setOpen(false);
                          if (item.unread) void api.post(`/notifications/${item.id}/read`);
                        }}
                      >
                        {t(`notifications.checkpoint.${item.checkpointKey}`, {
                          formula: item.formulaName,
                        })}
                      </Link>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.action}
                          data-testid={`notification-dismiss-${item.checkpointKey}`}
                          onClick={() => dismiss.mutate(item.id)}
                        >
                          {t('notifications.dismiss')}
                        </button>
                        <button
                          type="button"
                          className={styles.action}
                          data-testid={`notification-mute-${item.checkpointKey}`}
                          onClick={() => mute.mutate(item.formulaId)}
                        >
                          {t('notifications.muteFormula')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
