const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { errorHandler, statusFromDatabaseError } = require('../src/middleware/errorHandler');

function run(err) {
  const res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  errorHandler(err, { method: 'GET', originalUrl: '/api/tickets' }, res, () => {});
  return res;
}

describe('statusFromDatabaseError', () => {
  it('maps malformed input to 400 instead of 500', () => {
    assert.equal(statusFromDatabaseError({ code: '22P02' }), 400);   // bad uuid
    assert.equal(statusFromDatabaseError({ code: '22001' }), 400);   // value too long
    assert.equal(statusFromDatabaseError({ code: '22003' }), 400);   // out of range
  });

  it('maps constraint violations to 4xx', () => {
    assert.equal(statusFromDatabaseError({ code: '23505' }), 409);   // unique
    assert.equal(statusFromDatabaseError({ code: '23503' }), 400);   // foreign key
    assert.equal(statusFromDatabaseError({ code: '23514' }), 400);   // check
  });

  it('keeps genuine failures as 500', () => {
    assert.equal(statusFromDatabaseError({ code: '57014' }), 500);   // query cancelled
    assert.equal(statusFromDatabaseError({ code: '08006' }), 500);   // connection failure
    assert.equal(statusFromDatabaseError({}), 500);
    assert.equal(statusFromDatabaseError(null), 500);
  });
});

describe('errorHandler', () => {
  it('never leaks internals for a 500', () => {
    const err = new Error('select * from users -- connection postgres://user:pass@host/db');
    err.code = '57014';
    const res = run(err);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Internal server error' });
    assert.ok(!JSON.stringify(res.body).includes('postgres://'));
    assert.ok(!JSON.stringify(res.body).includes('SELECT'));
  });

  it('returns the intentional message for a 4xx', () => {
    const err = new Error('This ticket is assigned to another agent');
    err.status = 403;
    const res = run(err);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'This ticket is assigned to another agent');
  });

  it('turns a bad uuid into a 400 with a readable message', () => {
    const res = run({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /invalid input syntax/);
    assert.ok(!JSON.stringify(res.body).includes('SELECT'));
  });

  it('maps malformed JSON to 400', () => {
    const res = run({ type: 'entity.parse.failed' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Malformed JSON body');
  });

  it('maps an oversized body to 413', () => {
    const res = run({ type: 'entity.too.large' });
    assert.equal(res.statusCode, 413);
    assert.match(res.body.error, /too large/i);
  });

  it('includes optional details when supplied', () => {
    const err = new Error('validation failed');
    err.status = 400;
    err.details = { field: 'email' };
    assert.deepEqual(run(err).body, { error: 'validation failed', details: { field: 'email' } });
  });

  it('defaults a status-less error to 500', () => {
    assert.equal(run(new Error('boom')).statusCode, 500);
  });
});
