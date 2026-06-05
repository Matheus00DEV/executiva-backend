const { verifyToken } = require('../utils/token');

function obterToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-auth-token'] || '';
}

function exigirAutenticacao(req, res, next) {
  const usuario = verifyToken(obterToken(req));
  if (!usuario) {
    return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
  }

  req.usuario = usuario;
  return next();
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
