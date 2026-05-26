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

function exigirAdmin(req, res, next) {
  if (!['admin', 'administrador'].includes(String(req.usuario?.perfil || '').toLowerCase())) {
    return res.status(403).json({ error: 'Somente administrador pode realizar esta acao.' });
  }

  return next();
}

module.exports = {
  exigirAutenticacao,
  exigirAdmin
};
