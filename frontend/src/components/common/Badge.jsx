import { STATUS_COLOR, PRIORITY_COLOR } from '../../utils/constants';

const FALLBACK = 'bg-slate-100 text-slate-700';

export default function Badge({ children, tone }) {
  const cls = STATUS_COLOR[tone] || PRIORITY_COLOR[tone] || FALLBACK;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}