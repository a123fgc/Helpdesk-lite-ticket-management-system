export default function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg role="status" aria-label="Loading" className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}