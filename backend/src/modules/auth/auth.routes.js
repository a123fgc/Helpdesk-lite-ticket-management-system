const router = require('express').Router();
const c = require('./auth.controller');
const { authRequired } = require('../../middleware/auth');

router.post('/signup', c.signup);
router.post('/login',  c.login);
router.get('/me',      authRequired, c.me);

module.exports = router;