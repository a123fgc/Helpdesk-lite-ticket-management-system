const router = require('express').Router();
const c = require('./audit.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.get('/ticket/:ticketId', authRequired, requireRole('agent', 'admin'), c.byTicket);

router.use(authRequired, requireRole('admin'));
router.get('/', c.list);

module.exports = router;