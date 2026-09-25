import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { LandingPage } from './LandingPage';
import { planGrantsFeature } from './PlansSheet';

beforeAll(() => {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('renders the public marketing surface without asking for an account', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /every number in your formula, computed/i,
      }),
    ).toBeTruthy();
    const startLinks = screen.getAllByRole('link', { name: /start free/i });
    expect(startLinks.length).toBeGreaterThan(0);
    expect(startLinks.every((link) => link.getAttribute('href') === '/auth?mode=register')).toBe(
      true,
    );
    expect(screen.getByRole('heading', { name: /three moves, one engine/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /three plans, compared by what they do/i }),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: /three plans/i })).toBeTruthy();
  });

  it('keeps Free without sponsored listings and with a three-formula cap', () => {
    expect(planGrantsFeature('free', 'sponsored_listings')).toBe(false);
    expect(planGrantsFeature('enterprise', 'sponsored_listings')).toBe(true);
  });
});
