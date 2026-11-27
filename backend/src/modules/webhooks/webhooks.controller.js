const svc = require('./webhooks.service');

exports.list = async (req, res, next) => {
  try { res.json(await svc.list({ filters: req.query })); } catch (e) { next(e); }
};
exports.get = async (req, res, next) => {
  try { res.json(await svc.get(req.params.id)); } catch (e) { next(e); }
};
exports.resend = async (req, res, next) => {
  try {
    const result = await svc.resend(req.params.id);
    // A 200 must mean the external receiver accepted the event, not merely
    // that the API endpoint ran. Failed deliveries are reported as 502.
    res.status(result.delivered ? 200 : 502).json({
      ...result,
      ...(result.delivered ? {} : { error: `external delivery failed: ${result.error}` }),
    });
  } catch (e) { next(e); }
};