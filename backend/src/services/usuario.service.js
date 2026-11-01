const prisma = require('../lib/prisma');

async function listar() {
  return prisma.usuario.findMany({
    select: { id: true, nome: true, email: true, papel: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' }
  });
}

module.exports = { listar };
