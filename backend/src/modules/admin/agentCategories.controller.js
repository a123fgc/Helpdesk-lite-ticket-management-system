const svc = require('./agentCategories.service');

exports.list = async (req, res, next) => {
  try {
    res.json(await svc.list({ agentId: req.query.agent_id }));
  } catch (e) { next(e); }
};

exports.assign = async (req, res, next) => {
  try {
    const { agent_id, category_id } = req.body || {};
    res.status(201).json(await svc.assign({ agentId: agent_id, categoryId: category_id }));
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    res.json(await svc.remove({
      agentId: req.params.agentId,
      categoryId: req.params.categoryId,
    }));
  } catch (e) { next(e); }
};
