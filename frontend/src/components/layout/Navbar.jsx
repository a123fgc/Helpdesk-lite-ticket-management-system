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

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="app-topbar">
      <div className="flex items-center gap-3 sm:gap-4">
        {user && (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 md:hidden"
            aria-label="Open navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        )}
        <Link to="/" className="flex items-center gap-3" aria-label="HelpDesk home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm shadow-brand-600/25">
            H
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            HelpDesk<span className="text-brand-600"> Lite</span>
          </span>
        </Link>
        <span className="hidden border-l border-slate-200 pl-5 text-sm font-medium text-slate-500 lg:block">
          Support workspace
        </span>
      </div>

      {user && (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
              {initials(user.full_name)}
            </span>
            <div className="leading-tight">
              <div className="max-w-36 truncate text-sm font-semibold text-slate-800">{user.full_name}</div>
              <div className="text-[11px] font-medium capitalize tracking-wide text-slate-500">{user.role}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn-ghost px-3 py-2 text-xs sm:text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      )}
    </header>
  );
}
