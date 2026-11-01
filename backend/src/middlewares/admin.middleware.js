const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

async function exigirAdmin(req, res, next) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.userId },
    select: { papel: true }
  });

  if (!usuario) {
    throw new AppError('Usuário não encontrado', 401);
  }
  if (usuario.papel !== 'ADMIN') {
    throw new AppError('Acesso restrito a administradores', 403);
  }
  next();
}

module.exports = exigirAdmin;
