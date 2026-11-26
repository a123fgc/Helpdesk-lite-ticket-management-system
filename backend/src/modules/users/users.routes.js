const router = require('express').Router();
const c = require('./users.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.use(authRequired, requireRole('agent','admin'));
router.get('/agents', c.listAgents);

module.exports = router;