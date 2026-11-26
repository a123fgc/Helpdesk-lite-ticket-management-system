const router = require('express').Router();
const c = require('./admin.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.use(authRequired, requireRole('admin'));

router.get('/metrics', c.metrics);

router.get('/api-keys',           c.listApiKeys);
router.post('/api-keys',          c.createApiKey);
router.post('/api-keys/:id/revoke', c.revokeApiKey);

router.get('/agents',             c.listAgents);
router.post('/agents',            c.createAgent);
router.patch('/agents/:id/active', c.setAgentActive);

module.exports = router;