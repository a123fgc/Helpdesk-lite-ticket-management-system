import api from './axios';

export const authApi = {
  signup: (data) => api.post('/auth/signup', data),
  login:  (data) => api.post('/auth/login', data),
  me:     () => api.get('/auth/me'),
};

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params }),
  summary: () => api.get('/tickets/summary'),
  get:  (id) => api.get(`/tickets/${id}`),
  downloadAttachment: (ticketId, attachmentId) => api.get(
    `/tickets/${ticketId}/attachments/${attachmentId}`,
    { responseType: 'blob' }
  ),
  create: (formData) => api.post('/tickets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  assignSelf: (id) => api.post(`/tickets/${id}/assign-self`),
  changeStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
};

export const messagesApi = {
  list:   (ticketId) => api.get(`/messages/${ticketId}`),
  create: (ticketId, body) => api.post(`/messages/${ticketId}`, { body }),
};

export const notesApi = {
  list:   (ticketId) => api.get(`/notes/${ticketId}`),
  create: (ticketId, body) => api.post(`/notes/${ticketId}`, { body }),
};

export const categoriesApi = {
  list:   (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
};

export const slaApi = {
  list:   () => api.get('/sla'),
  upsert: (data) => api.put('/sla', data),
};

export const webhooksApi = {
  list:   (params) => api.get('/webhooks', { params }),
  resend: (id) => api.post(`/webhooks/${id}/resend`),
};

export const auditApi = {
  list: (params) => api.get('/audit', { params }),
  byTicket: (ticketId) => api.get(`/audit/ticket/${ticketId}`),
};

export const adminApi = {
  metrics: () => api.get('/admin/metrics'),
  listApiKeys: () => api.get('/admin/api-keys'),
  createApiKey: (name) => api.post('/admin/api-keys', { name }),
  revokeApiKey: (id) => api.post(`/admin/api-keys/${id}/revoke`),
  listAgents: () => api.get('/admin/agents'),
  createAgent: (data) => api.post('/admin/agents', data),
  setAgentActive: (id, is_active) => api.patch(`/admin/agents/${id}/active`, { is_active }),

  // Agent ↔ category assignments (drive round-robin ticket routing)
  listAgentCategories: (agentId) => api.get('/admin/agent-categories', {
    params: agentId ? { agent_id: agentId } : {},
  }),
  assignAgentCategory: (agent_id, category_id) =>
    api.post('/admin/agent-categories', { agent_id, category_id }),
  removeAgentCategory: (agent_id, category_id) =>
    api.delete(`/admin/agent-categories/${agent_id}/${category_id}`),
};

export const usersApi = {
  agents: () => api.get('/users/agents'),
};