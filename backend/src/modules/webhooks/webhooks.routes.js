const router = require('express').Router();
const c = require('./webhooks.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.use(authRequired, requireRole('admin'));
router.get('/', c.list);
router.get('/:id', c.get);
router.post('/:id/resend', c.resend);

module.exports = router;