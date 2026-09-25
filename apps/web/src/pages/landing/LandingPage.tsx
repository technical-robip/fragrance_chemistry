import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoundEdge, ForeEdge, Masthead } from './ManualChrome';
import { HeroSheet } from './HeroSheet';
import { ErrataSheet } from './ErrataSheet';
import { MethodSheet } from './MethodSheet';
import { DivisionSheet } from './DivisionSheet';
import { ComposeLeaf } from './ComposeLeaf';
import { ComplyLeaf, CostLeaf, EvaluateLeaf, WeighLeaf } from './DivisionLeaves';
import { AudienceSheet } from './AudienceSheet';
import { PlansSheet } from './PlansSheet';
import { ColophonSheet } from './ColophonSheet';
import { FaqSheet } from './FaqSheet';
import { CloseSheet, LandingFooter } from './CloseSheet';
import { useLandingHead } from './useLandingHead';
import { DIVISIONS, type DivisionId } from './manual';
import { IconClock, IconCost, IconFlask, IconScale, IconShield } from './icons';
import styles from './LandingPage.module.css';

/** Tracks which division the reader is inside, so the tab rail extends with them. */
function useCurrentDivision(): DivisionId | null {
  const [current, setCurrent] = useState<DivisionId | null>(null);

  useEffect(() => {
    const sections = DIVISIONS.map((d) => document.getElementById(d.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent(visible.target.id as DivisionId);
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return current;
}

export function LandingPage() {
  const { t } = useTranslation();
  const current = useCurrentDivision();
  useLandingHead();

  return (
    <div className={styles.page}>
      <a href="#manual" className={styles.skip}>
        {t('landing.header.skip')}
      </a>

      <BoundEdge />
      <ForeEdge current={current} />
      <Masthead />

      <main id="manual">
        <HeroSheet />
        <ErrataSheet />
        <MethodSheet />

        <DivisionSheet id="compose" icon={<IconFlask />} leaf={<ComposeLeaf />} />
        <DivisionSheet id="weigh" icon={<IconScale />} leaf={<WeighLeaf />} flip />
        <DivisionSheet id="comply" icon={<IconShield />} leaf={<ComplyLeaf />} />
        <DivisionSheet id="cost" icon={<IconCost />} leaf={<CostLeaf />} flip />
        <DivisionSheet id="evaluate" icon={<IconClock />} leaf={<EvaluateLeaf />} />

        <AudienceSheet />
        <PlansSheet />
        <ColophonSheet />
        <FaqSheet />
        <CloseSheet />
      </main>

      <LandingFooter />
    </div>
  );
}
