function paginate(req, defaults = { page: 1, limit: 20, maxLimit: 100 }) {
  const page = Math.max(1, parseInt(req.query.page, 10) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaults.limit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
module.exports = { paginate };