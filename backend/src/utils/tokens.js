const crypto = require('crypto');

/**
 * 32 bytes / 256 bits of CSPRNG output, hex-encoded (64 characters).
 *
 * The token must be unguessable: knowledge of it is the only thing standing
 * between a requester and submitting a satisfaction score on someone else's
 * ticket. It is therefore never derived from the ticket id or any other
 * predictable value.
 */
const SURVEY_TOKEN_BYTES = 32;

function generateSurveyToken() {
  return crypto.randomBytes(SURVEY_TOKEN_BYTES).toString('hex');
}

module.exports = { generateSurveyToken, SURVEY_TOKEN_BYTES };
