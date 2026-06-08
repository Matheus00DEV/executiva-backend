const { verifyToken } = require('../utils/token');
const db = require('../config/db');
const { boolEnv } = require('../utils/env');

function obterToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-auth-token'] || '';
}

async function carregarUsuarioAtivo(usuarioToken) {
  if (!boolEnv(process.env.AUTH_CHECK_USER_STATUS, true)) {
    return usuarioToken;
  }

  const { rows } = await db.query(`
    SELECT id, nome, usuario, perfil, status, pode_cadastrar, pode_relatorios
    FROM gestao_de_pneu
    WHERE id = $1
    LIMIT 1
  `, [usuarioToken.id]);

  const row = rows[0];
  if (!row) {
    const error = new Error('Sessao invalida. Faca login novamente.');
    error.status = 401;
    throw error;
  }

  if (row.status !== 'aprovado') {
    const error = new Error('Seu acesso nao esta ativo. Fale com o administrador.');
    error.status = 403;
    throw error;
  }

  return {
    ...usuarioToken,
    id: Number(row.id),
    nome: row.nome,
    usuario: row.usuario,
    perfil: row.perfil,
    status: row.status,
    podeCadastrar: row.pode_cadastrar !== false,
    podeRelatorios: row.pode_relatorios !== false
  };
}

async function exigirAutenticacao(req, res, next) {
  const usuario = verifyToken(obterToken(req));
  if (!usuario) {
    return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
  }

  if (usuario.status && usuario.status !== 'aprovado') {
    return res.status(403).json({ error: 'Seu acesso nao esta ativo. Fale com o administrador.' });
  }

  try {
    req.usuario = await carregarUsuarioAtivo(usuario);
    return next();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Erro ao conferir usuario autenticado:', error);
    return res.status(503).json({ error: 'Autenticacao indisponivel no momento.' });
  }
}

function perfilNormalizado(usuario) {
  const perfil = String(usuario?.perfil || '').trim().toLowerCase();
  if (['admin', 'administrador', 'adm'].includes(perfil)) return 'admin';
  if (['assistente', 'operacional'].includes(perfil)) return 'assistente';
  if (perfil === 'motorista') return 'motorista';
  return '';
}

function exigirAdmin(req, res, next) {
  if (perfilNormalizado(req.usuario) !== 'admin') {
    return res.status(403).json({ error: 'Somente administrador pode realizar esta acao.' });
  }

  return next();
}

function exigirOperacional(req, res, next) {
  if (!['admin', 'assistente'].includes(perfilNormalizado(req.usuario))) {
    return res.status(403).json({ error: 'Acesso permitido somente para a equipe operacional.' });
  }

  return next();
}

function exigirPermissaoCadastro(req, res, next) {
  if (!['admin', 'assistente'].includes(perfilNormalizado(req.usuario)) || req.usuario?.podeCadastrar === false) {
    return res.status(403).json({ error: 'Seu usuario nao possui permissao para cadastrar ou alterar dados.' });
  }

  return next();
}

function exigirPermissaoRelatorios(req, res, next) {
  if (!['admin', 'assistente'].includes(perfilNormalizado(req.usuario)) || req.usuario?.podeRelatorios === false) {
    return res.status(403).json({ error: 'Seu usuario nao possui permissao para acessar relatorios.' });
  }

  return next();
}

module.exports = {
  exigirAutenticacao,
  exigirAdmin,
  exigirOperacional,
  exigirPermissaoCadastro,
  exigirPermissaoRelatorios
};
