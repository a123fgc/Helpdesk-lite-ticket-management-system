const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { canViewTicket, canManageTicket } = require('../src/modules/tickets/tickets.service');
const { requireRole } = require('../src/middleware/role');

const AGENT_X = { sub: 'agent-x', role: 'agent' };
const AGENT_Y = { sub: 'agent-y', role: 'agent' };
const ADMIN = { sub: 'admin-1', role: 'admin' };
const CUSTOMER_A = { sub: 'customer-a', role: 'customer' };
const CUSTOMER_B = { sub: 'customer-b', role: 'customer' };

const mine = { id: 't1', created_by: 'customer-a', assigned_to: null };
const otherCustomers = { id: 't2', created_by: 'customer-b', assigned_to: null };
const assignedToY = { id: 't3', created_by: 'customer-a', assigned_to: 'agent-y' };
const assignedToX = { id: 't4', created_by: 'customer-a', assigned_to: 'agent-x' };

describe('ticket visibility (canViewTicket)', () => {
  it('lets a customer read only their own tickets', () => {
    assert.equal(canViewTicket(CUSTOMER_A, mine), true);
    assert.equal(canViewTicket(CUSTOMER_A, otherCustomers), false);
    assert.equal(canViewTicket(CUSTOMER_B, mine), false);
  });

  it('lets agents and admins read any ticket', () => {
    assert.equal(canViewTicket(AGENT_X, otherCustomers), true);
    assert.equal(canViewTicket(AGENT_Y, mine), true);
    assert.equal(canViewTicket(ADMIN, otherCustomers), true);
  });

  it('denies anything without a valid user or ticket', () => {
    assert.equal(canViewTicket(null, mine), false);
    assert.equal(canViewTicket(CUSTOMER_A, null), false);
    assert.equal(canViewTicket({ sub: 'x', role: 'superuser' }, mine), false);
  });
});

describe('ticket mutation (canManageTicket)', () => {
  it('denies customers outright', () => {
    assert.equal(canManageTicket(CUSTOMER_A, mine), false);
    assert.equal(canManageTicket(CUSTOMER_A, otherCustomers), false);
  });

  it('lets an agent act on an unassigned ticket', () => {
    assert.equal(canManageTicket(AGENT_X, mine), true);
    assert.equal(canManageTicket(AGENT_Y, mine), true);
  });

  it('lets an agent act on a ticket already assigned to them', () => {
    assert.equal(canManageTicket(AGENT_X, assignedToX), true);
  });

  it('blocks an agent from acting on another agent\'s ticket', () => {
    assert.equal(canManageTicket(AGENT_X, assignedToY), false);
    assert.equal(canManageTicket(AGENT_Y, assignedToX), false);
  });

  it('lets an admin act on any ticket', () => {
    assert.equal(canManageTicket(ADMIN, assignedToY), true);
    assert.equal(canManageTicket(ADMIN, assignedToX), true);
    assert.equal(canManageTicket(ADMIN, mine), true);
  });

  it('denies unknown roles and missing context', () => {
    assert.equal(canManageTicket({ sub: 'x', role: 'root' }, mine), false);
    assert.equal(canManageTicket(null, mine), false);
    assert.equal(canManageTicket(AGENT_X, null), false);
  });
});

describe('requireRole middleware', () => {
  function run(roles, user) {
    const res = {
      statusCode: null,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
    };
    let nextCalled = false;
    requireRole(...roles)({ user }, res, () => { nextCalled = true; });
    return { res, nextCalled };
  }

  it('calls next() when the role is permitted', () => {
    assert.equal(run(['agent', 'admin'], AGENT_X).nextCalled, true);
    assert.equal(run(['admin'], ADMIN).nextCalled, true);
    assert.equal(run(['customer'], CUSTOMER_A).nextCalled, true);
  });

  it('responds 403 when the role is not permitted', () => {
    const { res, nextCalled } = run(['admin'], AGENT_X);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  it('responds 403 for customers on agent-only routes', () => {
    assert.equal(run(['agent', 'admin'], CUSTOMER_A).nextCalled, false);
  });

  it('responds 403 when there is no authenticated user at all', () => {
    const { res, nextCalled } = run(['admin'], undefined);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it('accepts any of several permitted roles', () => {
    const { nextCalled } = run(['agent', 'admin'], ADMIN);
    assert.equal(nextCalled, true);
  });
});
