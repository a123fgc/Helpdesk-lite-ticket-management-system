import { Link } from 'react-router-dom';

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-brand-700 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 h-[32rem] w-[32rem] rounded-full border border-white/10" />
        <Link to="/" className="relative flex w-fit items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-brand-700">H</span>
          <span className="text-lg font-bold tracking-tight">HelpDesk Lite</span>
        </Link>

        <div className="relative max-w-xl py-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            A clearer way to support your customers
          </div>
          <h2 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">
            Great support starts with a clear picture.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
            Keep every request, conversation, and next step together—so your team can focus on helping.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              ['01', 'Capture'],
              ['02', 'Resolve'],
              ['03', 'Improve'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-xs font-semibold text-blue-200">{number}</div>
                <div className="mt-2 text-sm font-medium text-white">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-slate-400">
          <span>HelpDesk Lite</span>
          <span>Support, made human.</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex w-fit items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">H</span>
            <span className="font-bold tracking-tight text-slate-900">HelpDesk Lite</span>
          </Link>
          <div className="mb-8">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Support workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
          {children}
          <p className="mt-10 text-center text-xs text-slate-400">
            Secure access to your support workspace
          </p>
        </div>
      </section>
    </main>
  );
}
