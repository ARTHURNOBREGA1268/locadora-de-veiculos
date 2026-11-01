const jwt = require('jsonwebtoken');
const AppError = require('../lib/AppError');
const { getJwtSecret } = require('../lib/jwtConfig');

function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token não informado', 401);
  }

  const token = header.slice(7).trim();
  let usuarioId;

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const subject = payload && typeof payload === 'object' ? payload.sub : undefined;

    if (typeof subject !== 'string' || !/^[1-9]\d*$/.test(subject)) {
      throw new Error('Subject JWT inválido');
    }

    usuarioId = Number(subject);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      throw new Error('Subject JWT inválido');
    }
  } catch (erro) {
    throw new AppError('Token inválido ou expirado', 401);
  }

  req.userId = usuarioId;
  next();
}

module.exports = autenticar;
