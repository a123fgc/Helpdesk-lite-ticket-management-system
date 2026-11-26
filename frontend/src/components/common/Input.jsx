export default function Input({ label, error, className = '', ...rest }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className={`input ${error ? 'border-red-400 focus:ring-red-400' : ''}`} {...rest} />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', rows = 4, ...rest }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className={`input ${error ? 'border-red-400' : ''}`} rows={rows} {...rest} />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function Select({ label, children, error, className = '', ...rest }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className={`input ${error ? 'border-red-400' : ''}`} {...rest}>
        {children}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}