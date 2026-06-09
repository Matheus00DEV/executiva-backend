function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function erroInterno(req, res, mensagem, error) {
  const body = {
    error: mensagem,
    requestId: req?.id
  };

  if (!isProduction() && error?.message) {
    body.details = error.message;
  }

  return res.status(500).json(body);
}

module.exports = {
  erroInterno
};
