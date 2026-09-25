import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useUiStore } from '@/stores/ui-store';
import { useFormulaStore } from '@/stores/formula-store';
import '@/i18n';
import '@/styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Bootstrap() {
  const hydrateUi = useUiStore((s) => s.hydrateUi);
  const hydrateFormula = useFormulaStore((s) => s.hydrateFormula);
  useEffect(() => {
    hydrateUi();
    hydrateFormula();
  }, [hydrateUi, hydrateFormula]);
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Bootstrap />
    </QueryClientProvider>
  </StrictMode>,
);
