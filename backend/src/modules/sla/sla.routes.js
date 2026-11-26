const router = require('express').Router();
const c = require('./sla.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.use(authRequired, requireRole('admin'));
router.get('/', c.list);
router.put('/', c.upsert);

module.exports = router;