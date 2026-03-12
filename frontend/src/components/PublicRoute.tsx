import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './shared/LoadingSpinner';
import type { ReactNode } from 'react';


interface PublicRouteProps {
  children: ReactNode;
}

export default function PublicRoute({ children }: PublicRouteProps) {
  const { token, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />; // spinner opzionale

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
