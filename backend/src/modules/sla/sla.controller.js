const svc = require('./sla.service');

exports.list   = async (_q, res, next) => { try { res.json(await svc.list()); } catch (e) { next(e); } };
exports.upsert = async (req, res, next) => { try { res.json(await svc.upsert(req.body)); } catch (e) { next(e); } };