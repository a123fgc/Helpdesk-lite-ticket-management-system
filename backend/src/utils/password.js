/**
 * Password policy shared by signup and admin agent creation.
 *
 * Deliberately simple: length is the single highest-value control, and a
 * complexity ritual (upper/lower/digit/symbol) mostly trains people to append
 * "1!" — so we require length plus reject the most common weak passwords.
 */
const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwertyui', 'qwerty123', 'letmein1', 'welcome1', 'iloveyou',
  'admin123', 'helpdesk1', 'changeme', 'passw0rd', 'abc12345',
]);

function assertValidPassword(password) {
  if (typeof password !== 'string' || !password) {
    const e = new Error('password required'); e.status = 400; throw e;
  }
  if (password.length < MIN_LENGTH) {
    const e = new Error(`password must be at least ${MIN_LENGTH} characters`);
    e.status = 400; throw e;
  }
  if (password.length > MAX_LENGTH) {
    const e = new Error(`password must be at most ${MAX_LENGTH} characters`);
    e.status = 400; throw e;
  }
  if (COMMON.has(password.toLowerCase())) {
    const e = new Error('password is too common, please choose another');
    e.status = 400; throw e;
  }
}

module.exports = { assertValidPassword, MIN_LENGTH, MAX_LENGTH };
