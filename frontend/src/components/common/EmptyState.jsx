export default function EmptyState({ title = 'Nothing here', message, subtitle, action }) {
  const detail = message ?? subtitle;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200/70">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 0 0-2-2h-3.2a1 1 0 0 1-.7-.29l-1.42-1.42A1 1 0 0 0 11.98 3H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h4m-2 5 4-4m0 0 4 4m-4-4v8" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {detail && <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{detail}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}