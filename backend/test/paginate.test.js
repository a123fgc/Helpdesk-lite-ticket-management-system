const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { paginate, sanitizeSearch, DEFAULTS } = require('../src/utils/paginate');

describe('paginate', () => {
  it('applies defaults when nothing is supplied', () => {
    assert.deepEqual(paginate(), { page: 1, limit: 20, offset: 0 });
    assert.deepEqual(paginate({}), { page: 1, limit: 20, offset: 0 });
  });

  it('computes the offset from page and limit', () => {
    assert.deepEqual(paginate({ page: '3', limit: '25' }), { page: 3, limit: 25, offset: 50 });
    assert.deepEqual(paginate({ page: 2 }), { page: 2, limit: 20, offset: 20 });
  });

  it('clamps an oversized limit instead of rejecting it', () => {
    assert.equal(paginate({ limit: 10000 }).limit, DEFAULTS.maxLimit);
    assert.equal(paginate({ limit: 101 }).limit, 100);
    assert.equal(paginate({ limit: 100 }).limit, 100);
  });

  it('rejects a non-integer page', () => {
    assert.throws(() => paginate({ page: 'abc' }), (e) => e.status === 400);
    assert.throws(() => paginate({ page: 1.5 }), (e) => e.status === 400);
    assert.throws(() => paginate({ page: '1e3' }), (e) => e.status === 400);
  });

  it('rejects a page below 1', () => {
    assert.throws(() => paginate({ page: 0 }), (e) => e.status === 400);
    assert.throws(() => paginate({ page: '-5' }), (e) => e.status === 400);
  });

  it('rejects a page large enough to produce an abusive OFFSET', () => {
    assert.throws(() => paginate({ page: DEFAULTS.maxPage + 1 }), (e) => e.status === 400);
    assert.equal(paginate({ page: String(DEFAULTS.maxPage) }).page, DEFAULTS.maxPage);
  });

  it('rejects a non-integer or negative limit', () => {
    assert.throws(() => paginate({ limit: 'lots' }), (e) => e.status === 400);
    assert.throws(() => paginate({ limit: 0 }), (e) => e.status === 400);
    assert.throws(() => paginate({ limit: -10 }), (e) => e.status === 400);
  });

  it('treats empty strings as "not supplied"', () => {
    assert.deepEqual(paginate({ page: '', limit: '' }), { page: 1, limit: 20, offset: 0 });
  });

  it('honours per-caller overrides', () => {
    assert.equal(paginate({ limit: 50 }, { maxLimit: 25 }).limit, 25);
    assert.equal(paginate({}, { limit: 5, page: 2 }).page, 2);
  });
});

describe('sanitizeSearch', () => {
  it('returns null for absent or blank input', () => {
    assert.equal(sanitizeSearch(undefined), null);
    assert.equal(sanitizeSearch(null), null);
    assert.equal(sanitizeSearch(''), null);
    assert.equal(sanitizeSearch('   '), null);
  });

  it('trims surrounding whitespace', () => {
    assert.equal(sanitizeSearch('  invoice  '), 'invoice');
  });

  it('rejects a search longer than the configured maximum', () => {
    assert.throws(() => sanitizeSearch('x'.repeat(201)), (e) => e.status === 400);
    assert.equal(sanitizeSearch('x'.repeat(200)).length, 200);
  });

  it('escapes LIKE wildcards so they match literally', () => {
    assert.equal(sanitizeSearch('50%'), '50\\%');
    assert.equal(sanitizeSearch('a_b'), 'a\\_b');
    assert.equal(sanitizeSearch('c\\d'), 'c\\\\d');
  });

  it('accepts a custom length limit', () => {
    assert.throws(() => sanitizeSearch('abcdef', { maxSearchLength: 3 }), (e) => e.status === 400);
  });
});
