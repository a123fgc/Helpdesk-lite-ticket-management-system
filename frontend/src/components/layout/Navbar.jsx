import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="app-topbar">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-3" aria-label="HelpDesk home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm">
            H
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900">
            HelpDesk<span className="text-brand-600"> Lite</span>
          </span>
        </Link>
        <span className="hidden border-l border-slate-200 pl-6 text-sm font-medium text-slate-500 sm:block">
          Support workspace
        </span>
      </div>

      {user && (
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
              {initials(user.full_name)}
            </span>
            <div className="leading-tight">
              <div className="max-w-40 truncate text-sm font-semibold text-slate-800">{user.full_name}</div>
              <div className="mt-1 text-xs capitalize text-slate-500">{user.role}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn-ghost px-3 py-2 text-xs sm:text-sm">
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">Exit</span>
          </button>
        </div>
      )}
    </header>
  );
}
