const router = require('express').Router();
const c = require('./categories.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');

// any logged-in user can read categories (customers need them to create tickets)
router.get('/', authRequired, c.list);

// admin-only for mutations
router.post('/',             authRequired, requireRole('admin'), c.create);
router.patch('/:id',         authRequired, requireRole('admin'), c.update);
router.delete('/:id',        authRequired, requireRole('admin'), c.remove);

module.exports = router;