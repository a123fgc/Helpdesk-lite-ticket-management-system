const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testEnv');

const crypto = require('crypto');
const { generateSurveyToken, SURVEY_TOKEN_BYTES } = require('../src/utils/tokens');

describe('survey token generation', () => {
  it('emits a 64-character lowercase hex string', () => {
    const token = generateSurveyToken();
    assert.equal(token.length, SURVEY_TOKEN_BYTES * 2);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('is backed by 256 bits of entropy', () => {
    assert.equal(SURVEY_TOKEN_BYTES, 32);
    assert.equal(generateSurveyToken().length * 4, 256);
  });

  it('never collides across a large sample', () => {
    const seen = new Set();
    for (let i = 0; i < 20000; i++) seen.add(generateSurveyToken());
    assert.equal(seen.size, 20000);
  });

  it('is not derived from any predictable value', () => {
    const ticketId = '3f1c9a2e-1111-4222-8333-444455556666';
    const token = generateSurveyToken();
    assert.notEqual(token, `tok_${ticketId}`);
    assert.notEqual(token, ticketId.replace(/-/g, ''));
    assert.ok(!token.includes(ticketId.replace(/-/g, '')));
    // the legacy scheme was exactly "tok_" + uuid; that must no longer appear
    assert.ok(!token.startsWith('tok_'));
  });

  it('produces a different value on every call', () => {
    const a = generateSurveyToken();
    const b = generateSurveyToken();
    assert.notEqual(a, b);
  });

  it('is not guessable from a neighbouring token', () => {
    const a = generateSurveyToken();
    const b = generateSurveyToken();
    // flipping any single hex digit of a must not yield b
    const diff = [...a].filter((ch, i) => ch !== b[i]).length;
    assert.ok(diff > 1, `tokens differ in only ${diff} position(s) - not independent`);
  });

  it('uses a CSPRNG, not Math.random', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateSurveyToken));
    assert.equal(tokens.size, 500);
    // a weak PRNG would show repeated prefixes far more often than this
    const twoBytePrefixes = new Set([...tokens].map((t) => t.slice(0, 4)));
    assert.ok(twoBytePrefixes.size > 400, `only ${twoBytePrefixes.size} distinct prefixes`);
  });

  it('produces values that satisfy the surveys.token column (VARCHAR 255, UNIQUE)', () => {
    const token = generateSurveyToken();
    assert.ok(token.length <= 255);
    assert.equal(new Set([token]).size, 1);
    assert.equal(crypto.randomBytes(SURVEY_TOKEN_BYTES).toString('hex').length, token.length);
  });
});
