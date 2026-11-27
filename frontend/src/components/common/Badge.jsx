import { STATUS_COLOR, PRIORITY_COLOR } from '../../utils/constants';

const FALLBACK = 'bg-slate-100 text-slate-700 ring-slate-200';

export default function Badge({ children, tone }) {
  const cls = STATUS_COLOR[tone] || PRIORITY_COLOR[tone] || FALLBACK;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}