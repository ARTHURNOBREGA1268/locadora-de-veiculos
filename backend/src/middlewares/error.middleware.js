const AppError = require('../lib/AppError');

function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

function tratarErros(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido' });
  }

  if (err.code === 'P2034') {
    return res.status(409).json({ erro: 'Conflito de concorrência; atualize os dados e tente novamente' });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({ erro: 'Registro duplicado' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado' });
  }

  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

module.exports = { naoEncontrado, tratarErros };
