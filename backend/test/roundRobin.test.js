const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const { nextAgentIndex } = require('../src/services/roundRobin');

const agents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('nextAgentIndex (round-robin cursor)', () => {
  it('returns -1 when no agent is eligible', () => {
    assert.equal(nextAgentIndex([], 'a'), -1);
    assert.equal(nextAgentIndex(null, 'a'), -1);
    assert.equal(nextAgentIndex(undefined, null), -1);
  });

  it('starts at the first agent when there is no cursor', () => {
    assert.equal(nextAgentIndex(agents, null), 0);
    assert.equal(nextAgentIndex(agents, undefined), 0);
    assert.equal(nextAgentIndex(agents, ''), 0);
  });

  it('moves to the next agent after the cursor', () => {
    assert.equal(nextAgentIndex(agents, 'a'), 1);
    assert.equal(nextAgentIndex(agents, 'b'), 2);
  });

  it('wraps around at the end of the roster', () => {
    assert.equal(nextAgentIndex(agents, 'c'), 0);
  });

  it('restarts at the first agent when the cursor is stale', () => {
    // e.g. the previous assignee was removed from this category
    assert.equal(nextAgentIndex(agents, 'zzz'), 0);
  });

  it('handles a single-agent roster without dividing by zero', () => {
    const one = [{ id: 'only' }];
    assert.equal(nextAgentIndex(one, null), 0);
    assert.equal(nextAgentIndex(one, 'only'), 0);
    assert.equal(nextAgentIndex(one, 'other'), 0);
  });

  it('visits every agent exactly once per full cycle', () => {
    const seen = [];
    let cursor = null;
    for (let i = 0; i < agents.length; i++) {
      const idx = nextAgentIndex(agents, cursor);
      seen.push(agents[idx].id);
      cursor = agents[idx].id;
    }
    assert.deepEqual(seen, ['a', 'b', 'c']);
  });

  it('keeps cycling after the first full cycle', () => {
    const seen = [];
    let cursor = null;
    for (let i = 0; i < 6; i++) {
      const idx = nextAgentIndex(agents, cursor);
      seen.push(agents[idx].id);
      cursor = agents[idx].id;
    }
    assert.deepEqual(seen, ['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('is deterministic for the same cursor', () => {
    assert.equal(nextAgentIndex(agents, 'b'), nextAgentIndex(agents, 'b'));
  });
});
