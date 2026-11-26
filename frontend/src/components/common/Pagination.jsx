export default function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs text-slate-500">Page <b className="text-slate-800">{page}</b> of {pages}</span>
      <button type="button" className="btn-ghost px-3 py-2" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>←</button>
      <button type="button" className="btn-ghost px-3 py-2" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  );
}