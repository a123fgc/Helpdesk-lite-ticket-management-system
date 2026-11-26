const svc = require('./categories.service');

exports.list   = async (req, res, next) => { try { res.json(await svc.list({ includeInactive: req.query.include_inactive === 'true' })); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.body)); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { res.json(await svc.update({ id: req.params.id, ...req.body })); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { res.json(await svc.remove(req.params.id)); } catch (e) { next(e); } };