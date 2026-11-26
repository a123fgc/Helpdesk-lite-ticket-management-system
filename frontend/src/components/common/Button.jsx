const VARIANTS = {
  primary: 'btn-primary',
  ghost:   'btn-ghost',
  danger:  'btn-danger',
};

const SIZES = {
  sm: 'text-xs px-2 py-1',
  md: '',
  lg: 'text-base px-4 py-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}) {
  const cls = `${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || ''} ${className}`;
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? '…' : children}
    </button>
  );
}