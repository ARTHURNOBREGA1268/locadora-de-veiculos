const jwt = require('jsonwebtoken');
const AppError = require('../lib/AppError');
const { getJwtSecret } = require('../lib/jwtConfig');
const prisma = require('../lib/prisma');

async function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token não informado', 401);
  }

  let usuarioId;
  let tokenVersion;
  try {
    const payload = jwt.verify(header.slice(7).trim(), getJwtSecret(), { algorithms: ['HS256'] });
    const subject = payload && typeof payload === 'object' ? payload.sub : undefined;
    const versao = payload && typeof payload === 'object' ? payload.ver : undefined;

    if (typeof subject !== 'string' || !/^[1-9]\d*$/.test(subject)) {
      throw new Error('Subject JWT inválido');
    }
    usuarioId = Number(subject);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      throw new Error('Subject JWT inválido');
    }

    tokenVersion = versao === undefined ? 0 : versao;
    if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
      throw new Error('Versão JWT inválida');
    }
  } catch (erro) {
    throw new AppError('Token inválido ou expirado', 401);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { ativo: true, papel: true, tokenVersion: true }
  });
  if (!usuario || !usuario.ativo || (usuario.tokenVersion ?? 0) !== tokenVersion) {
    throw new AppError('Sessão inválida ou usuário inativo', 401);
  }

  req.userId = usuarioId;
  req.userRole = usuario.papel;
  next();
}

module.exports = autenticar;
