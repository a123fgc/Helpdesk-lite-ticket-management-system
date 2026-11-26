import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute, { homeFor } from './routes/ProtectedRoute';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';

import CustomerDashboard from './pages/customer/CustomerDashboard';
import MyTickets from './pages/customer/MyTickets';
import CreateTicket from './pages/customer/CreateTicket';
import TicketDetail from './pages/customer/TicketDetail';

import AgentDashboard from './pages/agent/AgentDashboard';
import TicketQueue from './pages/agent/TicketQueue';
import AgentTicketDetail from './pages/agent/AgentTicketDetail';

import AdminDashboard from './pages/admin/AdminDashboard';
import ManageAgents from './pages/admin/ManageAgents';
import ManageCategories from './pages/admin/ManageCategories';
import ManageSLAs from './pages/admin/ManageSLAs';
import ManageApiKeys from './pages/admin/ManageApiKeys';
import WebhookEvents from './pages/admin/WebhookEvents';
import AuditLog from './pages/admin/AuditLog';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Customer */}
      <Route path="/customer" element={<ProtectedRoute roles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
      <Route path="/customer/tickets" element={<ProtectedRoute roles={['customer']}><MyTickets /></ProtectedRoute>} />
      <Route path="/customer/tickets/new" element={<ProtectedRoute roles={['customer']}><CreateTicket /></ProtectedRoute>} />
      <Route path="/customer/tickets/:id" element={<ProtectedRoute roles={['customer']}><TicketDetail /></ProtectedRoute>} />

      {/* Agent */}
      <Route path="/agent" element={<ProtectedRoute roles={['agent']}><AgentDashboard /></ProtectedRoute>} />
      <Route path="/agent/queue" element={<ProtectedRoute roles={['agent']}><TicketQueue /></ProtectedRoute>} />
      <Route path="/agent/tickets/:id" element={<ProtectedRoute roles={['agent']}><AgentTicketDetail /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/agents" element={<ProtectedRoute roles={['admin']}><ManageAgents /></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute roles={['admin']}><ManageCategories /></ProtectedRoute>} />
      <Route path="/admin/slas" element={<ProtectedRoute roles={['admin']}><ManageSLAs /></ProtectedRoute>} />
      <Route path="/admin/api-keys" element={<ProtectedRoute roles={['admin']}><ManageApiKeys /></ProtectedRoute>} />
      <Route path="/admin/webhooks" element={<ProtectedRoute roles={['admin']}><WebhookEvents /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute roles={['admin']}><AuditLog /></ProtectedRoute>} />

      <Route path="*" element={<div className="p-8">404 — Not Found</div>} />
    </Routes>
  );
}