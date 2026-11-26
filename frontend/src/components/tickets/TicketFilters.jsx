import { useEffect, useState } from 'react';
import { categoriesApi, usersApi } from '../../api/endpoints';
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL } from '../../utils/constants';
import { Select } from '../common/Input';

export default function TicketFilters({ filters, onChange, showAssignee = false, showMine = false }) {
  const [cats, setCats] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    categoriesApi.list()
      .then((r) => setCats(r.data))
      .catch(() => setLoadError('Could not load categories'));
    if (showAssignee) {
      usersApi.agents()
        .then((r) => setAgents(r.data))
        .catch(() => setLoadError('Could not load the agent list'));
    }
  }, [showAssignee]);

  function change(k, v) {
    onChange({ ...filters, [k]: v, page: k === 'page' ? v : 1 });
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10m-7 6h4" />
        </svg>
        Filter tickets
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <input
          className="input"
          aria-label="Search tickets"
          placeholder="Search by subject or ticket number"
          value={filters.search || ''}
          onChange={(e) => change('search', e.target.value)}
        />
        <Select aria-label="Filter by status" value={filters.status || ''} onChange={(e) => change('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <Select aria-label="Filter by priority" value={filters.priority || ''} onChange={(e) => change('priority', e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </Select>
        <Select aria-label="Filter by category" value={filters.category_id || ''} onChange={(e) => change('category_id', e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {showAssignee && (
          <Select aria-label="Filter by assignee" value={filters.assigned_to || ''} onChange={(e) => change('assigned_to', e.target.value)}>
            <option value="">Any assignee</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </Select>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-400">{loadError}</div>
        {showMine && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={filters.mine === 'true'}
              onChange={(e) => change('mine', e.target.checked ? 'true' : '')}
            />
            Assigned to me
          </label>
        )}
      </div>
    </div>
  );
}