import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { RootGate } from '@/components/auth/RootGate';
import { AuthPage } from '@/pages/AuthPage';
import { AccountPage } from '@/pages/AccountPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { AdminPlanDetailPage } from '@/pages/admin/AdminPlanDetailPage';
import { AdminPlansPage } from '@/pages/admin/AdminPlansPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { CostingPage } from '@/pages/CostingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EncyclopediaPage } from '@/pages/EncyclopediaPage';
import { EvaluationPage } from '@/pages/EvaluationPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { LiveWeighingPage } from '@/pages/LiveWeighingPage';
import { MaterialDetailPage } from '@/pages/MaterialDetailPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { WorkbenchPage } from '@/pages/WorkbenchPage';

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: <RootGate />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'catalog/:materialId', element: <MaterialDetailPage /> },
      { path: 'workbench', element: <WorkbenchPage /> },
      { path: 'weighing', element: <LiveWeighingPage /> },
      { path: 'costing', element: <CostingPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'evaluation', element: <EvaluationPage /> },
      { path: 'encyclopedia', element: <EncyclopediaPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'account', element: <AccountPage /> },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <AdminOverviewPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'users/:userId', element: <AdminUserDetailPage /> },
          { path: 'plans', element: <AdminPlansPage /> },
          { path: 'plans/:planId', element: <AdminPlanDetailPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
