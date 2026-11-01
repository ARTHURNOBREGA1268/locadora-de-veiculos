const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

async function cadastrar({ marca, modelo, placa, ano, valorDiaria }) {
  if (typeof marca !== 'string' || !marca.trim()) {
    throw new AppError('Marca é obrigatória', 400);
  }
  if (typeof modelo !== 'string' || !modelo.trim()) {
    throw new AppError('Modelo é obrigatório', 400);
  }
  if (typeof placa !== 'string' || !placa.trim()) {
    throw new AppError('Placa é obrigatória', 400);
  }

  const anoNumero = Number(ano);
  const anoMaximo = new Date().getFullYear() + 1;
  if (!Number.isInteger(anoNumero) || anoNumero < 1900 || anoNumero > anoMaximo) {
    throw new AppError('Ano inválido', 400);
  }

  const valor = Number(valorDiaria);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new AppError('Valor da diária deve ser positivo', 400);
  }

  const placaNormalizada = placa.trim().toUpperCase();

  const existente = await prisma.veiculo.findUnique({
    where: { placa: placaNormalizada },
    select: { id: true }
  });
  if (existente) {
    throw new AppError('Placa já cadastrada', 409);
  }

  return prisma.veiculo.create({
    data: {
      marca: marca.trim(),
      modelo: modelo.trim(),
      placa: placaNormalizada,
      ano: anoNumero,
      valorDiaria: valor
    }
  });
}

async function listar({ disponivel }) {
  const where = {};

  if (disponivel !== undefined) {
    if (disponivel !== 'true' && disponivel !== 'false') {
      throw new AppError('Filtro disponivel deve ser true ou false', 400);
    }
    where.disponivel = disponivel === 'true';
  }

  return prisma.veiculo.findMany({ where, orderBy: { id: 'asc' } });
}

module.exports = { cadastrar, listar };
