// Shared UI primitives translating the Modernist design system into Tailwind + React.
export function Button({ variant = 'secondary', block, icon, className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-heading font-extrabold text-sm px-4 py-2.5 border cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white border-accent hover:bg-accent-600 active:bg-accent-700',
    secondary: 'bg-transparent text-ink border-ink/40 hover:bg-neutral-200',
    ghost: 'bg-transparent text-ink border-transparent hover:bg-neutral-200',
    icon: 'bg-transparent text-ink border-transparent hover:bg-neutral-200 p-2',
  };
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${block ? 'w-full justify-start' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// variant: 'neutral' (calm/default) | 'outline' (pending) | 'accent' (needs attention)
export function Tag({ variant = 'neutral', children }) {
  const variants = {
    neutral: 'bg-neutral-200 text-ink',
    outline: 'bg-transparent text-ink border border-ink/40',
    accent: 'bg-accent-100 text-accent-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-heading font-semibold ${variants[variant]}`}>{children}</span>;
}

export function Card({ kicker, title, children, className = '' }) {
  return (
    <div className={`bg-white border border-line p-4 ${className}`}>
      {kicker && <div className="text-xs uppercase tracking-wide opacity-55 mb-1">{kicker}</div>}
      {title && <div className="font-heading font-extrabold text-lg mb-1">{title}</div>}
      {children}
    </div>
  );
}

export function Field({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label htmlFor={htmlFor} className="text-xs opacity-70">{label}</label>
      {children}
    </div>
  );
}

export const inputClass = 'border border-line bg-neutral-100 px-3 py-2 text-sm w-full outline-none focus-visible:outline-2 focus-visible:outline-accent';
export const th = 'text-start text-xs uppercase tracking-wide opacity-55 border-b-2 border-line pb-2 pe-4 font-body font-normal';
export const td = 'py-3 border-b border-line text-sm pe-4';
export const hr = 'h-0.5 bg-line my-4';
