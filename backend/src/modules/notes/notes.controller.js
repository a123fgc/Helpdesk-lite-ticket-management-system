const svc = require('./notes.service');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list({ ticketId: req.params.ticketId })); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await svc.create({ user: req.user, ticketId: req.params.ticketId, body: req.body.body })); }
  catch (e) { next(e); }
};