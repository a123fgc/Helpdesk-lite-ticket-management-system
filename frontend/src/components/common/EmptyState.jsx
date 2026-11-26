export default function EmptyState({ title = 'Nothing here', message, action }) {
  return (
    <div className="text-center py-10">
      <div className="text-slate-400 text-4xl mb-2">📭</div>
      <h3 className="font-medium text-slate-700">{title}</h3>
      {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}