const jwt = require('jsonwebtoken');
const AppError = require('../lib/AppError');

function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token não informado', 401);
  }

  const token = header.slice(7).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(payload.sub);
    next();
  } catch (erro) {
    throw new AppError('Token inválido ou expirado', 401);
  }
}

module.exports = autenticar;
