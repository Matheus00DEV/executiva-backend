const crypto = require('crypto');
const { numberEnv } = require('../utils/env');

const MAX_JSON_DEPTH = numberEnv('MAX_JSON_DEPTH', 8, { min: 3, max: 30 });
const MAX_ARRAY_LENGTH = numberEnv('MAX_ARRAY_LENGTH', 1000, { min: 10, max: 10000 });
const MAX_STRING_LENGTH = numberEnv('MAX_STRING_LENGTH', 5000, { min: 200, max: 50000 });
const MAX_ATTACHMENTS = numberEnv('MAX_ATTACHMENTS', 5, { min: 1, max: 30 });
const MAX_ATTACHMENT_BYTES = numberEnv('MAX_ATTACHMENT_BYTES', 10 * 1024 * 1024, { min: 1024, max: 50 * 1024 * 1024 });

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ATTACHMENT_KEYS = new Set(['anexo', 'anexos', 'arquivo', 'arquivos', 'foto', 'fotos', 'documento', 'documentos', 'comprovante', 'comprovantes']);
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

function requestContext(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  req.id = incoming && incoming.length <= 80 ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function noStoreApi(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

function exigirContentTypeValido(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

  const contentLength = Number(req.headers['content-length'] || 0);
  if (!contentLength) return next();

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const permitido = contentType.includes('application/json') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  if (!permitido) {
    return res.status(415).json({ error: 'Tipo de conteudo nao permitido para esta rota.' });
  }

  return next();
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function fileExtension(name) {
  const clean = String(name || '').trim().toLowerCase();
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index) : '';
}

function validarAnexo(anexo, path, errors) {
  if (!isObject(anexo)) {
    errors.push(`${path}: anexo invalido.`);
    return;
  }

  const nome = String(anexo.nome || anexo.name || '').trim();
  const tipo = String(anexo.tipo || anexo.type || anexo.mime || '').trim().toLowerCase();
  const tamanho = Number(anexo.tamanho || anexo.size || 0);
  const ext = fileExtension(nome);

  if (!nome || nome.length > 180 || /[\\/]/.test(nome) || nome.includes('..')) {
    errors.push(`${path}: nome de anexo invalido.`);
  }

  if (tipo && tipo !== 'arquivo' && !ALLOWED_MIME.has(tipo)) {
    errors.push(`${path}: tipo de anexo nao permitido.`);
  }

  if (!ALLOWED_EXT.has(ext)) {
    errors.push(`${path}: extensao de anexo nao permitida.`);
  }

  if (Number.isFinite(tamanho) && tamanho > MAX_ATTACHMENT_BYTES) {
    errors.push(`${path}: anexo excede o tamanho permitido.`);
  }
}

function validarListaAnexos(lista, path, errors) {
  if (!Array.isArray(lista)) return;
  if (lista.length > MAX_ATTACHMENTS) {
    errors.push(`${path}: limite de ${MAX_ATTACHMENTS} anexos por envio.`);
    return;
  }

  lista.forEach((anexo, index) => validarAnexo(anexo, `${path}[${index}]`, errors));
}

function inspecionarPayload(value, path, depth, seen, errors) {
  if (!isObject(value)) {
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      errors.push(`${path}: texto excede o tamanho permitido.`);
    }
    return;
  }

  if (seen.has(value)) return;
  seen.add(value);

  if (depth > MAX_JSON_DEPTH) {
    errors.push(`${path}: estrutura muito profunda.`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      errors.push(`${path}: lista excede o limite de itens.`);
      return;
    }
    value.forEach((item, index) => inspecionarPayload(item, `${path}[${index}]`, depth + 1, seen, errors));
    return;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      errors.push(`${path}.${key}: chave nao permitida.`);
      continue;
    }

    const nextValue = value[key];
    const nextPath = `${path}.${key}`;
    if (ATTACHMENT_KEYS.has(key.toLowerCase())) {
      validarListaAnexos(nextValue, nextPath, errors);
    }
    inspecionarPayload(nextValue, nextPath, depth + 1, seen, errors);
  }
}

function protegerPayload(req, res, next) {
  if (!req.body || !isObject(req.body)) return next();

  const errors = [];
  inspecionarPayload(req.body, 'body', 0, new WeakSet(), errors);

  if (errors.length) {
    return res.status(400).json({
      error: 'Payload recusado por regra de seguranca.',
      detalhes: errors.slice(0, 5)
    });
  }

  return next();
}

module.exports = {
  requestContext,
  noStoreApi,
  exigirContentTypeValido,
  protegerPayload
};
