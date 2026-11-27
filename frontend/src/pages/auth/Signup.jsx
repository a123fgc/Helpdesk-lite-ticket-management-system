import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../api/axios';
import Input from '../../components/common/Input';
import AuthLayout from '../../components/layout/AuthLayout';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await signup(form.full_name, form.email, form.password);
      navigate('/customer');
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Signup failed. Please try again.'));
    } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Create your account" description="Get one place to follow every support request.">
      <form onSubmit={onSubmit} className="space-y-5">
        {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
        <Input
          label="Full name"
          required
          autoComplete="name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
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
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? 'Creating account…' : 'Create customer account'}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-600">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
