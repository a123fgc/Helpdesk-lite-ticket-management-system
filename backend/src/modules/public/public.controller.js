const svc = require('./public.service');

exports.submitSurvey = async (req, res, next) => {
  try {
    const out = await svc.submitSurvey(req.body);
    res.json(out);
  } catch (e) { next(e); }
};