const prisma = require('../lib/prisma');
const AppError = require('../lib/AppError');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function converterData(valor, campo) {
  if (valor === undefined || valor === null || valor === '') {
    throw new AppError(`${campo} é obrigatória`, 400);
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new AppError(`${campo} inválida`, 400);
  }
  return data;
}

function calcularValorTotal(valorDiaria, inicio, fim) {
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / MS_POR_DIA);
  return Math.round(Number(valorDiaria) * dias * 100) / 100;
}

async function reservarVeiculo(tx, veiculoId) {
  const locacaoAtiva = await tx.locacao.findFirst({
    where: { veiculoId, status: 'ATIVA' },
    select: { id: true }
  });

  if (locacaoAtiva) {
    throw new AppError('Veículo já possui locação ativa', 409);
  }

  const reserva = await tx.veiculo.updateMany({
    where: { id: veiculoId, disponivel: true },
    data: { disponivel: false }
  });

  if (reserva.count === 0) {
    throw new AppError('Veículo indisponível', 409);
  }
}

async function criar({ usuarioId, veiculoId, dataInicio, dataPrevistaDevolucao }) {
  const veiculoIdNumero = Number(veiculoId);
  if (!Number.isInteger(veiculoIdNumero) || veiculoIdNumero <= 0) {
    throw new AppError('veiculoId inválido', 400);
  }

  const inicio = converterData(dataInicio, 'Data de início');
  const fim = converterData(dataPrevistaDevolucao, 'Data prevista de devolução');

  if (fim.getTime() <= inicio.getTime()) {
    throw new AppError('Data prevista de devolução deve ser posterior à data de início', 400);
  }

  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoIdNumero } });
  if (!veiculo) {
    throw new AppError('Veículo não encontrado', 404);
  }
  if (!veiculo.disponivel) {
    throw new AppError('Veículo indisponível', 409);
  }

  const valorTotal = calcularValorTotal(veiculo.valorDiaria, inicio, fim);

  return prisma.$transaction(async (tx) => {
    await reservarVeiculo(tx, veiculoIdNumero);

    return tx.locacao.create({
      data: {
        usuarioId,
        veiculoId: veiculoIdNumero,
        dataInicio: inicio,
        dataPrevistaDevolucao: fim,
        valorTotal
      },
      include: { veiculo: true }
    });
  });
}

async function listarDoUsuario(usuarioId) {
  return prisma.locacao.findMany({
    where: { usuarioId },
    include: { veiculo: true },
    orderBy: { id: 'desc' }
  });
}

async function buscarDoUsuario(usuarioId, id) {
  const locacaoId = Number(id);
  if (!Number.isInteger(locacaoId) || locacaoId <= 0) {
    throw new AppError('Id de locação inválido', 400);
  }

  const locacao = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: { veiculo: true }
  });
  if (!locacao) {
    throw new AppError('Locação não encontrada', 404);
  }
  if (locacao.usuarioId !== usuarioId) {
    throw new AppError('Acesso negado a esta locação', 403);
  }
  return locacao;
}

async function finalizar(usuarioId, id) {
  const locacao = await buscarDoUsuario(usuarioId, id);

  if (locacao.status === 'FINALIZADA') {
    throw new AppError('Locação já finalizada', 409);
  }

  return prisma.$transaction(async (tx) => {
    const encerramento = await tx.locacao.updateMany({
      where: { id: locacao.id, status: 'ATIVA' },
      data: { status: 'FINALIZADA', dataDevolucaoEfetiva: new Date() }
    });

    if (encerramento.count === 0) {
      throw new AppError('Locação já finalizada', 409);
    }

    await tx.veiculo.update({
      where: { id: locacao.veiculoId },
      data: { disponivel: true }
    });

    return tx.locacao.findUnique({
      where: { id: locacao.id },
      include: { veiculo: true }
    });
  });
}

module.exports = { criar, listarDoUsuario, buscarDoUsuario, finalizar, reservarVeiculo };
