const router = require('express').Router();
const c = require('./notes.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

router.use(authRequired, requireRole('agent','admin'));
router.get('/:ticketId', c.list);
router.post('/:ticketId', c.create);

module.exports = router;