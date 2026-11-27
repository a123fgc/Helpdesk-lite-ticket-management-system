import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { adminApi, categoriesApi } from '../../api/endpoints';

/**
 * Admin screen for agent ↔ category assignments.
 *
 * These assignments are exactly what the backend's round-robin uses to pick
 * the owner of a new ticket, so a change here takes effect on the next ticket
 * created for that category.
 */
export default function ManageAgentCategories() {
  const [agents, setAgents] = useState(null);
  const [categories, setCategories] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [agentId, setAgentId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(null);

  function load() {
    setError('');
    Promise.all([
      adminApi.listAgents(),
      categoriesApi.list({ include_inactive: true }),
      adminApi.listAgentCategories(),
    ])
      .then(([a, c, ac]) => {
        setAgents(a.data);
        setCategories(c.data);
        setAssignments(ac.data);
        setAgentId((current) => current || (a.data[0] && a.data[0].id) || '');
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load assignments'));
  }

  useEffect(load, []);

  const assignedForAgent = useMemo(() => {
    if (!assignments || !agentId) return new Set();
    return new Set(
      assignments.filter((a) => a.agent_id === agentId).map((a) => a.category_id)
    );
  }, [assignments, agentId]);

  const allRows = assignments || [];

  async function toggle(category) {
    const key = `${agentId}:${category.id}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      if (assignedForAgent.has(category.id)) {
        await adminApi.removeAgentCategory(agentId, category.id);
        setNotice(`Removed ${category.name} from the selected agent.`);
      } else {
        await adminApi.assignAgentCategory(agentId, category.id);
        setNotice(`Assigned ${category.name} to the selected agent.`);
      }
      const { data } = await adminApi.listAgentCategories();
      setAssignments(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update assignment');
    } finally {
      setBusy(null);
    }
  }

  async function removeRow(row) {
    const key = `${row.agent_id}:${row.category_id}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await adminApi.removeAgentCategory(row.agent_id, row.category_id);
      const { data } = await adminApi.listAgentCategories();
      setAssignments(data);
      setNotice(`Removed ${row.category_name} from ${row.agent_name}.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove assignment');
    } finally {
      setBusy(null);
    }
  }

  const loading = !agents || !categories || !assignments;

  return (
    <Layout>
      <div className="page-shell max-w-6xl">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Administration</div>
            <h1 className="page-title">Agent categories</h1>
            <p className="page-subtitle">Choose which agents can receive tickets in each category. New tickets are handed out round-robin across the assigned agents.</p>
          </div>
        </div>

        {error && <div role="alert" className="alert-error">{error}</div>}
        {notice && <div role="status" className="alert-success">{notice}</div>}

        {loading && !error && <div className="card flex items-center gap-3 p-6 text-sm text-slate-500"><Spinner />Loading assignments…</div>}

        {agents && agents.length === 0 && (
          <div className="card"><EmptyState title="No agents yet" message="Create an agent first, then assign categories." /></div>
        )}

        {agents && agents.length > 0 && categories && (
          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="agent-select">Agent</label>
                <select
                  id="agent-select"
                  className="input max-w-xl"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({a.email}){a.is_active ? '' : ' — disabled'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                {assignedForAgent.size} of {categories.length} categories assigned
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="pt-4"><EmptyState title="No categories yet" message="Create a category first." /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {categories.map((c) => {
                  const isAssigned = assignedForAgent.has(c.id);
                  const key = `${agentId}:${c.id}`;
                  return (
                    <li key={c.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                          {!c.is_active && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200/80">
                              Inactive
                            </span>
                          )}
                        </div>
                        {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${isAssigned ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {isAssigned ? 'Assigned' : 'Not assigned'}
                        </span>
                        <button
                          type="button"
                          className={isAssigned ? 'btn-ghost px-3 py-2 text-xs' : 'btn-primary px-3 py-2 text-xs'}
                          disabled={busy === key}
                          onClick={() => toggle(c)}
                        >
                          {busy === key ? 'Saving…' : isAssigned ? 'Remove' : 'Assign'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {assignments && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Current assignments</h2>
              <p className="mt-1 text-sm text-slate-500">All active agent-category routing assignments.</p>
            </div>
            {allRows.length === 0 ? (
              <div className="card"><EmptyState title="No assignments yet" message="Assign an agent above to start round-robin routing." /></div>
            ) : (
              <div className="card overflow-hidden">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Category</th>
                        <th>Agent status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map((row) => (
                        <tr key={`${row.agent_id}:${row.category_id}`}>
                          <td>
                            <div className="font-medium text-slate-800">{row.agent_name}</div>
                            <div className="text-xs text-slate-500">{row.agent_email}</div>
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-slate-700">{row.category_name}</span>
                              {!row.category_active && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200/80">Inactive</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {row.agent_active
                              ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">Active</span>
                              : <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">Disabled</span>}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn-ghost px-3 py-2 text-xs"
                              disabled={busy === `${row.agent_id}:${row.category_id}`}
                              onClick={() => removeRow(row)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}