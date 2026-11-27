import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const customerLinks = [
  { to: '/customer', label: 'Overview', icon: 'grid', end: true },
  { to: '/customer/tickets', label: 'My tickets', icon: 'ticket', end: true },
  { to: '/customer/tickets/new', label: 'New request', icon: 'plus' },
];

const agentLinks = [
  { to: '/agent', label: 'Overview', icon: 'grid', end: true },
  { to: '/agent/queue', label: 'Ticket queue', icon: 'ticket' },
];

const adminLinks = [
  { to: '/admin', label: 'Overview', icon: 'grid', end: true },
  { to: '/admin/agents', label: 'Agents', icon: 'users' },
  { to: '/admin/agent-categories', label: 'Agent categories', icon: 'route' },
  { to: '/admin/categories', label: 'Categories', icon: 'folder' },
  { to: '/admin/slas', label: 'SLA rules', icon: 'clock' },
  { to: '/admin/api-keys', label: 'API keys', icon: 'key' },
  { to: '/admin/webhooks', label: 'Webhook events', icon: 'bolt' },
  { to: '/admin/audit', label: 'Audit log', icon: 'list' },
];

function NavIcon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    ticket: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v3a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-3a2.5 2.5 0 0 0 0-5z" /><path d="M9 8h6M9 12h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    folder: <><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 7.7-7.7 2 2-2 2 1.5 1.5-2 2-1.5-1.5-3 3" /></>,
    bolt: <path d="m13 2-3 8h7l-6 12 1-9H5z" />,
    route: <><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h5a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      {paths[name]}
    </svg>
  );
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user } = useAuth();
  if (!user) return null;

  const links = user.role === 'admin'
    ? adminLinks
    : user.role === 'agent'
      ? agentLinks
      : customerLinks;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] flex-col border-r bg-white shadow-xl transition-transform duration-200 ease-out md:static md:z-auto md:h-[calc(100vh-4rem)] md:w-64 md:max-w-none md:translate-x-0 md:border-b-0 md:border-r md:shadow-none md:transition-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {initials(user.full_name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user.full_name}</div>
              <div className="text-xs capitalize text-slate-500">{user.role}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="hidden px-5 pb-3 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:block">
          Workspace
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-3 md:py-0">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={onClose}
                className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 group-hover:text-slate-600'}`}>
                      <NavIcon name={link.icon} />
                    </span>
                    <span className="truncate">{link.label}</span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="px-4 pb-5 pt-4 md:px-5 md:pb-6 md:pt-6">
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="text-xs font-semibold text-slate-700">Need a hand?</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">Your support workspace keeps every request in one place.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
