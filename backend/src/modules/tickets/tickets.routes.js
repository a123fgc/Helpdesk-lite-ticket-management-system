const router = require('express').Router();
const c = require('./tickets.controller');
const { authRequired } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const env = require('../../config/env');
const logger = require('../../utils/logger');

// ── multer for attachments (max 2) ──────────────────────
const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const allowedTypes = {
  '.pdf': {
    mimeType: 'application/pdf',
    matches: (header) => header.subarray(0, 5).toString() === '%PDF-',
  },
  '.jpg': {
    mimeType: 'image/jpeg',
    matches: (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff,
  },
  '.jpeg': {
    mimeType: 'image/jpeg',
    matches: (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff,
  },
  '.png': {
    mimeType: 'image/png',
    matches: (header) => header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  '.gif': {
    mimeType: 'image/gif',
    matches: (header) => ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString()),
  },
  '.webp': {
    mimeType: 'image/webp',
    matches: (header) => header.subarray(0, 4).toString() === 'RIFF'
      && header.subarray(8, 12).toString() === 'WEBP',
  },
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 2 },
});

async function validateAttachments(req, _res, next) {
  const files = req.files || [];
  try {
    for (const file of files) {
      const extension = path.extname(file.originalname).toLowerCase();
      const type = allowedTypes[extension];
      if (!type || file.mimetype !== type.mimeType) {
        const error = new Error('Only PDF, JPEG, PNG, GIF, and WebP files are allowed');
        error.status = 400;
        throw error;
      }

      const handle = await fs.promises.open(file.path, 'r');
      try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        if (!type.matches(header.subarray(0, bytesRead))) {
          const error = new Error('Attachment content does not match its file type');
          error.status = 400;
          throw error;
        }
      } finally {
        await handle.close();
      }
    }
    next();
  } catch (error) {
    await Promise.all(files.map(async (file) => {
      try {
        await fs.promises.unlink(file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          logger.error('Failed to remove rejected upload:', cleanupError.message);
        }
      }
    }));
    next(error);
  }
}

router.use(authRequired);

router.post('/', requireRole('customer'), upload.array('attachments', 2), validateAttachments, c.create);
router.get('/', c.list);
router.get('/summary', c.summary);
router.get('/:id/attachments/:attachmentId', c.downloadAttachment);
router.get('/:id', c.get);
router.post('/:id/assign-self', requireRole('agent','admin'), c.assignSelf);
router.patch('/:id/status', requireRole('agent','admin'), c.changeStatus);

module.exports = router;