import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'guest' | 'host' | 'admin';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center py-20"><p className="text-gray-500">Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    const dashboard = user?.role === 'host' ? '/host/dashboard' : user?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
}
