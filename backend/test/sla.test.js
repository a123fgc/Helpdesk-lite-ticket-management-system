const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { computeSlaFromRule } = require('../src/services/slaEngine');

const HOUR = 60 * 60 * 1000;

describe('computeSlaFromRule', () => {
  it('returns nulls when there is no SLA rule for the priority', () => {
    assert.deepEqual(computeSlaFromRule(null), { response_due: null, resolve_due: null });
    assert.deepEqual(computeSlaFromRule(undefined, new Date()), { response_due: null, resolve_due: null });
  });

  it('adds the response window to the creation time', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const out = computeSlaFromRule({ response_minutes: 60, resolution_minutes: 240 }, created);
    assert.equal(out.response_due.toISOString(), '2026-01-01T01:00:00.000Z');
    assert.equal(out.resolve_due.toISOString(), '2026-01-01T04:00:00.000Z');
  });

  it('keeps the resolve deadline after the response deadline', () => {
    const out = computeSlaFromRule({ response_minutes: 240, resolution_minutes: 60 }, new Date());
    assert.ok(out.resolve_due.getTime() < out.response_due.getTime());
  });

  it('handles sub-hour windows (urgent = 1 minute response)', () => {
    const created = new Date('2026-06-15T12:00:00.000Z');
    const out = computeSlaFromRule({ response_minutes: 1, resolution_minutes: 480 }, created);
    assert.equal(out.response_due.getTime(), created.getTime() + 60000);
    assert.equal(out.resolve_due.getTime(), created.getTime() + 480 * 60000);
  });

  it('produces a Date instance (not a string or number)', () => {
    const out = computeSlaFromRule({ response_minutes: 10, resolution_minutes: 20 });
    assert.ok(out.response_due instanceof Date);
    assert.ok(out.resolve_due instanceof Date);
  });

  it('is stable for the same input', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const rule = { response_minutes: 30, resolution_minutes: 90 };
    assert.equal(
      computeSlaFromRule(rule, created).resolve_due.getTime(),
      computeSlaFromRule(rule, created).resolve_due.getTime()
    );
  });

  it('does not mutate the rule row', () => {
    const rule = { response_minutes: 30, resolution_minutes: 90 };
    computeSlaFromRule(rule, new Date());
    assert.deepEqual(rule, { response_minutes: 30, resolution_minutes: 90 });
  });

  it('uses hour-sized windows for the seeded low-priority rule', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const out = computeSlaFromRule({ response_minutes: 24 * 60, resolution_minutes: 72 * 60 }, created);
    assert.equal(out.response_due.getTime() - created.getTime(), 24 * HOUR);
    assert.equal(out.resolve_due.getTime() - created.getTime(), 72 * HOUR);
  });
});
