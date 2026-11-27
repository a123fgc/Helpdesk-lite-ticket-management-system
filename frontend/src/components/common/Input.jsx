import { useId } from 'react';

export default function Input({ label, error, className = '', id, ...rest }) {
  const generatedId = useId();
  const inputId = id || rest.name || generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <input
        id={inputId}
        className={`input ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', rows = 4, id, ...rest }) {
  const generatedId = useId();
  const inputId = id || rest.name || generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <textarea
        id={inputId}
        className={`input resize-y ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
        rows={rows}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, children, error, className = '', id, ...rest }) {
  const generatedId = useId();
  const inputId = id || rest.name || generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <select
        id={inputId}
        className={`input ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}