import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/axios';
import { homeFor } from '../../routes/ProtectedRoute';
import Input from '../../components/common/Input';
import AuthLayout from '../../components/layout/AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await login(form.email, form.password);
      navigate(homeFor(u.role));
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Login failed. Please check your details and try again.'));
    } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Welcome back" description="Sign in to pick up where you left off.">
      <form onSubmit={onSubmit} className="space-y-5">
        {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in to your account'}
        </button>

        <p className="text-sm text-center text-slate-600">
          New to HelpDesk Lite? <Link to="/signup" className="font-semibold text-brand-700 hover:text-brand-600">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
