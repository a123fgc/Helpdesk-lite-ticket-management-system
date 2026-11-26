const svc = require('./webhooks.service');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list({ filters: req.query })); } catch (e) { next(e); }
};
exports.get = async (req, res, next) => {
  try { res.json(await svc.get(req.params.id)); } catch (e) { next(e); }
};
exports.resend = async (req, res, next) => {
  try { res.json(await svc.resend(req.params.id)); } catch (e) { next(e); }
};