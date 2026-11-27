export default function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return (
    <div className="flex w-full flex-col items-center justify-between gap-3 text-sm sm:flex-row">
      <span className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{start}-{end}</span> of <span className="font-semibold text-slate-700">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost px-3 py-2" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="min-w-[6rem] text-center text-xs font-medium text-slate-600">Page {page} of {pages}</span>
        <button type="button" className="btn-ghost px-3 py-2" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}