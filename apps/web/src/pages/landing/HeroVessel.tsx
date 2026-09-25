import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CssPerfumeVessel } from '@/components/viz/CssPerfumeVessel';
import styles from './HeroSheet.module.css';

const FlaconFigure = lazy(() =>
  import('@/components/viz/three/FlaconFigure').then((m) => ({ default: m.FlaconFigure })),
);

function useStaticVessel() {
  const [staticVessel, setStaticVessel] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 60rem)');

    function sync() {
      setStaticVessel(motion.matches || narrow.matches);
    }

    sync();
    motion.addEventListener('change', sync);
    narrow.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      narrow.removeEventListener('change', sync);
    };
  }, []);

  return staticVessel;
}

/**
 * Title-page figure: the procedural flacon when WebGL and motion are available,
 * the existing CSS vessel otherwise. Small viewports stay on the CSS vessel so
 * the first paint does not wait on a renderer.
 */
export function HeroVessel() {
  const { t } = useTranslation();
  const staticVessel = useStaticVessel();
  const [unavailable, setUnavailable] = useState(false);
  const label = t('landing.hero.vesselLabel');

  if (staticVessel || unavailable) {
    return (
      <div className={styles.vessel}>
        <CssPerfumeVessel levelPct={20} label={t('common.appName')} compact />
      </div>
    );
  }

  return (
    <div className={styles.vessel}>
      <Suspense fallback={<CssPerfumeVessel levelPct={20} label={t('common.appName')} compact />}>
        <FlaconFigure view="packaged" label={label} onUnavailable={() => setUnavailable(true)} />
      </Suspense>
    </div>
  );
}
