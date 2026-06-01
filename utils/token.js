const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;

function authSecret() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || process.env.DB_PASSWORD || 'executiva-dev-secret';
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64Url(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function signPart(data) {
  return base64Url(crypto.createHmac('sha256', authSecret()).update(data).digest());
}

function signToken(usuario, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    perfil: usuario.perfil,
    podeCadastrar: usuario.podeCadastrar,
    podeRelatorios: usuario.podeRelatorios,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  }));
  const data = `${header}.${payload}`;
  return `${data}.${signPart(data)}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = signPart(data);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(payload));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken
};
