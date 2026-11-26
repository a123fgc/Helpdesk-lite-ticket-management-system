const router = require('express').Router();
const c = require('./public.controller');
const { apiKeyRequired } = require('../../middleware/apiKey');
const { idempotency } = require('../../middleware/idempotency');

// Make.com calls these with X-API-Key + Idempotency-Key
router.post('/survey', apiKeyRequired, idempotency, c.submitSurvey);

module.exports = router;