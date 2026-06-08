const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DEFAULT_EXPIRES_IN = '12h';
const MIN_SECRET_LENGTH = 32;
const DEFAULT_ISSUER = 'executiva-frota';
const DEFAULT_AUDIENCE = 'executiva-frota-web';
let devSecret = '';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function authSecret() {
  if (process.env.JWT_SECRET || process.env.AUTH_SECRET) {
    return process.env.JWT_SECRET || process.env.AUTH_SECRET;
  }

  if (isProduction()) return '';

  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
  }

  return devSecret;
}

function validarConfiguracaoToken() {
  const secret = authSecret();

  if (!secret) {
    throw new Error('JWT_SECRET precisa estar configurado em producao.');
  }

  if (isProduction() && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET precisa ter pelo menos ${MIN_SECRET_LENGTH} caracteres em producao.`);
  }

  return true;
}

function payloadUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    perfil: usuario.perfil,
    status: usuario.status,
    podeCadastrar: usuario.podeCadastrar,
    podeRelatorios: usuario.podeRelatorios
  };
}

function signToken(usuario) {
  validarConfiguracaoToken();
  return jwt.sign(payloadUsuario(usuario), authSecret(), {
    subject: String(usuario.id),
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
    algorithm: 'HS256'
  });
}

function verifyToken(token) {
  if (!token) return null;

  try {
    validarConfiguracaoToken();
    return jwt.verify(token, authSecret(), {
      issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
      audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
      algorithms: ['HS256']
    });
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  validarConfiguracaoToken
};
