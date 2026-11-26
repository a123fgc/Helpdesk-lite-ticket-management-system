const svc = require('./users.service');
exports.listAgents = async (_q, res, next) => { try { res.json(await svc.listAgents()); } catch (e) { next(e); } };