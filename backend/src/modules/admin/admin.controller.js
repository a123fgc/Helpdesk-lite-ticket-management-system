const svc = require('./admin.service');

exports.listApiKeys   = async (_q, res, next) => { try { res.json(await svc.listApiKeys()); } catch (e) { next(e); } };
exports.createApiKey  = async (req, res, next) => { try { res.status(201).json(await svc.createApiKey({ actorId: req.user.sub, name: req.body.name })); } catch (e) { next(e); } };
exports.revokeApiKey  = async (req, res, next) => { try { res.json(await svc.revokeApiKey(req.params.id)); } catch (e) { next(e); } };

exports.metrics       = async (_q, res, next) => { try { res.json(await svc.dashboardMetrics()); } catch (e) { next(e); } };

exports.listAgents    = async (_q, res, next) => { try { res.json(await svc.listAgents()); } catch (e) { next(e); } };
exports.createAgent   = async (req, res, next) => { try { res.status(201).json(await svc.createAgent(req.body)); } catch (e) { next(e); } };
exports.setAgentActive= async (req, res, next) => { try { res.json(await svc.setAgentActive({ id: req.params.id, isActive: !!req.body.is_active })); } catch (e) { next(e); } };