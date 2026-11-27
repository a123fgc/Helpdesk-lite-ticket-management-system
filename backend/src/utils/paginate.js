/**
 * Pagination + search-query validation shared by every list endpoint.
 *
 *   const { page, limit, offset } = paginate(req.query, { maxLimit: 50 });
 *
 * Bounds are deliberately conservative so a client cannot ask the database
 * for an unbounded page or an unbounded ILIKE pattern.
 */
const DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
  // Guards `LIMIT/OFFSET` against absurd values (OFFSET is O(offset) in PG).
  maxPage: 100000,
  // Guards against pathological search strings.
  maxSearchLength: 200,
};

/**
 * Parses a query parameter that must represent an integer.
 * Returns `null` when the parameter is absent, `NaN` when it is malformed.
 * The value must look like an integer (`"1e3"`, `"1.5"`, `"abc"` are not).
 */
function toInt(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  const s = String(value).trim();
  if (s === '') return null;
  if (!/^-?\d+$/.test(s)) return NaN;
  return Number(s);
}

function paginate(query = {}, defaults = {}) {
  const cfg = { ...DEFAULTS, ...defaults };

  const rawPage = toInt(query.page);
  if (Number.isNaN(rawPage)) { const e = new Error('page must be an integer'); e.status = 400; throw e; }
  if (rawPage !== null && rawPage < 1) { const e = new Error('page must be >= 1'); e.status = 400; throw e; }
  if (rawPage !== null && rawPage > cfg.maxPage) {
    const e = new Error(`page must be <= ${cfg.maxPage}`); e.status = 400; throw e;
  }
  const page = rawPage === null ? cfg.page : rawPage;

  const rawLimit = toInt(query.limit);
  if (Number.isNaN(rawLimit)) { const e = new Error('limit must be an integer'); e.status = 400; throw e; }
  if (rawLimit !== null && rawLimit < 1) { const e = new Error('limit must be >= 1'); e.status = 400; throw e; }
  // Oversized limits are clamped rather than rejected so existing clients
  // that ask for "everything" keep working, just bounded.
  const limit = rawLimit === null ? cfg.limit : Math.min(cfg.maxLimit, rawLimit);

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Validates a free-text search term and escapes LIKE/ILIKE metacharacters so
 * user input can only match literally (never act as a wildcard).
 */
function sanitizeSearch(search, defaults = {}) {
  if (search === undefined || search === null) return null;
  const cfg = { ...DEFAULTS, ...defaults };
  const value = String(search).trim();
  if (!value) return null;
  if (value.length > cfg.maxSearchLength) {
    const e = new Error(`search must be <= ${cfg.maxSearchLength} characters`);
    e.status = 400;
    throw e;
  }
  return value
    .replace(/[\\%_]/g, (ch) => '\\' + ch);
}

module.exports = { paginate, sanitizeSearch, DEFAULTS };
