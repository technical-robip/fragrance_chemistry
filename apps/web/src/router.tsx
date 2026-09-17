import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AuthPage } from '@/pages/AuthPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { CostingPage } from '@/pages/CostingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EncyclopediaPage } from '@/pages/EncyclopediaPage';
import { EvaluationPage } from '@/pages/EvaluationPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { LiveWeighingPage } from '@/pages/LiveWeighingPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { WorkbenchPage } from '@/pages/WorkbenchPage';

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'workbench', element: <WorkbenchPage /> },
      { path: 'weighing', element: <LiveWeighingPage /> },
      { path: 'costing', element: <CostingPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'evaluation', element: <EvaluationPage /> },
      { path: 'encyclopedia', element: <EncyclopediaPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
