const router = require('express').Router();
const c = require('./messages.controller');
const { authRequired } = require('../../middleware/auth');

router.use(authRequired);
router.get('/:ticketId', c.list);
router.post('/:ticketId', c.create);

module.exports = router;