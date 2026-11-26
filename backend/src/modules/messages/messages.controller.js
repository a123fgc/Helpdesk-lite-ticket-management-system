const svc = require('./messages.service');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list({ user: req.user, ticketId: req.params.ticketId })); }
  catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const m = await svc.create({ user: req.user, ticketId: req.params.ticketId, body: req.body.body });
    res.status(201).json(m);
  } catch (e) { next(e); }
};