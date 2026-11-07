import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Role, useAuth } from '../contexts/AuthContext';

interface RoleProtectedRouteProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export default function RoleProtectedRoute({
  allowedRoles,
  children,
}: RoleProtectedRouteProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
