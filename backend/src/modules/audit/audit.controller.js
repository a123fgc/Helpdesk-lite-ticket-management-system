const svc = require('./audit.service');

exports.list     = async (req, res, next) => { try { res.json(await svc.list({ filters: req.query })); } catch (e) { next(e); } };
exports.byTicket = async (req, res, next) => { try { res.json(await svc.byTicket(req.params.ticketId)); } catch (e) { next(e); } };