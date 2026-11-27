/**
 * MUST be required before any application module.
 *
 * Supplies isolated, non-production configuration so unit tests never read
 * `backend/.env`. dotenv does not overwrite variables that are already set,
 * so these values win.
 *
 * Integration tests opt in with a real test database:
 *   TEST_DATABASE_URL=postgres://... npm test
 * Without it, DATABASE_URL points at an unreachable placeholder and the
 * integration suite skips itself.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgres://helpdesk_test@127.0.0.1:5432/helpdesk_test';
}

// Forced unconditionally so tests are hermetic and never inherit a real
// production secret from the shell or from backend/.env.
process.env.JWT_SECRET = 'unit-test-jwt-secret-not-a-real-credential';
process.env.WEBHOOK_SECRET = 'unit-test-webhook-secret-not-a-real-credential';
process.env.JWT_EXPIRES_IN = '15m';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.WEBHOOK_BASE_DELAY_MS = process.env.WEBHOOK_BASE_DELAY_MS || '60000';
process.env.WEBHOOK_MAX_RETRIES = process.env.WEBHOOK_MAX_RETRIES || '5';

module.exports = {
  /** True only when a dedicated test database was provided. */
  integrationEnabled: Boolean(process.env.TEST_DATABASE_URL),
};
