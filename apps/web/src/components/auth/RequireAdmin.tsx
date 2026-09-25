import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';

export function RequireAdmin({ children }: { children?: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}
