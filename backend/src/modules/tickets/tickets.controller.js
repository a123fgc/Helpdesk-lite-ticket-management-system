const svc = require('./tickets.service');

exports.create = async (req, res, next) => {
  try {
    const attachments = req.files || [];
    const ticket = await svc.createTicket({ user: req.user, body: req.body, attachments });
    res.status(201).json(ticket);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const out = await svc.listTickets({ user: req.user, filters: req.query });
    res.json(out);
  } catch (e) { next(e); }
};

exports.summary = async (req, res, next) => {
  try {
    res.json(await svc.ticketSummary({ user: req.user }));
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const ticket = await svc.getTicket({ user: req.user, id: req.params.id });
    res.json(ticket);
  } catch (e) { next(e); }
};

exports.downloadAttachment = async (req, res, next) => {
  try {
    const attachment = await svc.getAttachment({
      user: req.user,
      ticketId: req.params.id,
      attachmentId: req.params.attachmentId,
    });
    res.download(attachment.filePath, attachment.originalName, (err) => {
      if (!err) return;
      if (res.headersSent) return res.destroy(err);
      next(err);
    });
  } catch (e) { next(e); }
};

exports.assignSelf = async (req, res, next) => {
  try {
    const ticket = await svc.assignToSelf({ user: req.user, id: req.params.id });
    res.json(ticket);
  } catch (e) { next(e); }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const ticket = await svc.changeStatus({ user: req.user, id: req.params.id, newStatus: req.body.status });
    res.json(ticket);
  } catch (e) { next(e); }
};