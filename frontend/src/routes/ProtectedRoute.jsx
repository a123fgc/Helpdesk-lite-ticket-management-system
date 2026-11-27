import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4">
        <div className="card flex items-center gap-3 px-6 py-4 text-sm font-medium text-slate-600">
          <Spinner /> Loading workspace…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export function homeFor(role) {
  if (role === 'admin')    return '/admin';
  if (role === 'agent')    return '/agent';
  return '/customer';
}