const crypto = require('crypto');

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  const [scheme, iterationsRaw, salt, hash] = storedHash.split('$');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !salt || !hash) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.pbkdf2Sync(String(password), salt, iterations, expected.length, DIGEST);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = {
  hashPassword,
  verifyPassword
};
