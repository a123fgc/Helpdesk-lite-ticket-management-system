const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { VALID_TRANSITIONS, ALLOWED_STATUSES, isValidTransition } = require('../src/modules/tickets/tickets.service');

describe('status vocabulary', () => {
  it('exposes exactly the statuses the schema allows', () => {
    assert.deepEqual(
      [...ALLOWED_STATUSES].sort(),
      ['closed', 'in_progress', 'open', 'resolved', 'waiting_on_customer']
    );
  });

  it('has a transition entry for every allowed status', () => {
    for (const status of ALLOWED_STATUSES) {
      assert.ok(Array.isArray(VALID_TRANSITIONS[status]), `missing transitions for ${status}`);
    }
  });

  it('never references an unknown status as a destination', () => {
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const target of targets) assert.ok(ALLOWED_STATUSES.includes(target));
    }
  });

  it('treats terminal states as terminal', () => {
    assert.deepEqual(VALID_TRANSITIONS.closed, []);
  });
});

describe('isValidTransition', () => {
  it('allows the documented happy path', () => {
    assert.equal(isValidTransition('open', 'in_progress'), true);
    assert.equal(isValidTransition('in_progress', 'waiting_on_customer'), true);
    assert.equal(isValidTransition('in_progress', 'resolved'), true);
    assert.equal(isValidTransition('waiting_on_customer', 'in_progress'), true);
    assert.equal(isValidTransition('waiting_on_customer', 'resolved'), true);
    assert.equal(isValidTransition('resolved', 'closed'), true);
    assert.equal(isValidTransition('resolved', 'in_progress'), true);
  });

  it('rejects skipping straight to resolved from open', () => {
    assert.equal(isValidTransition('open', 'resolved'), false);
  });

  it('rejects reopening a closed ticket', () => {
    assert.equal(isValidTransition('closed', 'in_progress'), false);
    assert.equal(isValidTransition('closed', 'open'), false);
  });

  it('allows a no-op transition to the current status', () => {
    for (const status of ALLOWED_STATUSES) {
      assert.equal(isValidTransition(status, status), true, `${status} -> ${status}`);
    }
  });

  it('rejects an unknown source status', () => {
    assert.equal(isValidTransition('archived', 'open'), false);
  });

  it('rejects an unknown destination status', () => {
    assert.equal(isValidTransition('open', 'on_fire'), false);
  });

  it('is not symmetric (can reopen but not re-close)', () => {
    assert.equal(isValidTransition('resolved', 'in_progress'), true);
    assert.equal(isValidTransition('in_progress', 'closed'), false);
  });
});
