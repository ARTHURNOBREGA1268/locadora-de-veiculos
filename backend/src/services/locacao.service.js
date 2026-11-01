const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");
const { converterData } = require("../lib/isoDateTime");
const DIA = 86400000;
function calcularValorTotal(diaria, inicio, fim) {
  return (
    Math.round(Number(diaria) * Math.ceil((fim - inicio) / DIA) * 100) / 100
  );
}
async function reservarVeiculo(tx, id) {
  const locacaoAtiva = await tx.locacao.findFirst({
    where: {
      veiculoId: id,
      status: { in: ["reservada", "retirada", "em_andamento"] },
    },
    select: { id: true },
  });
  if (locacaoAtiva) throw new AppError("Veículo possui locação ativa", 409);
  const r = await tx.veiculo.updateMany({
    where: { id, status: "disponivel" },
    data: { status: "reservado" },
  });
  if (!r.count) throw new AppError("Veículo indisponível", 409);
}
async function config() {
  return prisma.configuracaoLocacao.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      documentosExigidos: ["CNH válida", "Documento de identidade"],
    },
    update: {},
  });
}
async function criar({
  usuarioId,
  veiculoId,
  dataInicio,
  dataPrevistaDevolucao,
}) {
  const vid = Number(veiculoId);
  if (!Number.isInteger(vid) || vid <= 0)
    throw new AppError("veiculoId inválido", 400);
  const inicio = converterData(dataInicio, "Data de início"),
    fim = converterData(dataPrevistaDevolucao, "Data prevista de devolução");
  if (fim <= inicio)
    throw new AppError(
      "Data prevista de devolução deve ser posterior à data de início",
      400,
    );
  const c = await config();
  const agora = Date.now(),
    horas = (inicio.getTime() - agora) / 3600000,
    dias = Math.ceil((fim - inicio) / DIA);
  if (horas < c.antecedenciaMinimaHoras)
    throw new AppError("Antecedência mínima não atendida", 400);
  if (horas > c.antecedenciaMaximaDias * 24)
    throw new AppError("Antecedência máxima excedida", 400);
  if (dias < c.periodoMinimoDiarias || dias > c.periodoMaximoDiarias)
    throw new AppError("Duração da locação fora dos limites permitidos", 400);
  const veiculo = await prisma.veiculo.findUnique({ where: { id: vid } });
  if (!veiculo) throw new AppError("Veículo não encontrado", 404);
  if (Number(veiculo.valorDiaria) <= 0)
    throw new AppError("Veículo sem diária precificada", 409);
  const valorTotal = calcularValorTotal(veiculo.valorDiaria, inicio, fim);
  return prisma.$transaction(async (tx) => {
    await reservarVeiculo(tx, vid, inicio);
    return tx.locacao.create({
      data: {
        usuarioId,
        veiculoId: vid,
        dataInicio: inicio,
        dataPrevistaDevolucao: fim,
        valorTotal,
        status: "reservada",
      },
      include: { veiculo: true },
    });
  });
}
async function listarDoUsuario(usuarioId) {
  return prisma.locacao.findMany({
    where: { usuarioId },
    include: { veiculo: true },
    orderBy: { id: "desc" },
  });
}
async function buscarDoUsuario(uid, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0)
    throw new AppError("Id de locação inválido", 400);
  const l = await prisma.locacao.findUnique({
    where: { id: n },
    include: { veiculo: true },
  });
  if (!l) throw new AppError("Locação não encontrada", 404);
  if (l.usuarioId !== uid)
    throw new AppError("Acesso negado a esta locação", 403);
  return l;
}
const transicoes = {
  retirar: ["reservada", "retirada"],
  iniciar: ["retirada", "em_andamento"],
  devolver: ["em_andamento", "devolvida"],
  finalizar: ["devolvida", "finalizada"],
  cancelar: ["reservada", "cancelada"],
};
async function transicionar(uid, id, acao) {
  const l = await buscarDoUsuario(uid, id);
  const [de, para] = transicoes[acao] || [];
  if (!de) throw new AppError("Transição inválida", 400);
  if (l.status !== de)
    throw new AppError(`Transição não permitida: locação ${l.status}`, 409);
  let multaCancelamentoCalculada = 0;
  if (acao === "cancelar") {
    const c = await config();
    const prazo = (l.dataInicio.getTime() - Date.now()) / 3600000;
    if (prazo <= c.cancelamentoPrazoHoras)
      multaCancelamentoCalculada =
        Math.round(
          Number(l.valorTotal) * Number(c.cancelamentoMultaPercentual),
        ) / 100;
  }
  return prisma.$transaction(async (tx) => {
    const data = { status: para };
    if (acao === "devolver") data.dataDevolucaoEfetiva = new Date();
    const upd = await tx.locacao.updateMany({
      where: { id: l.id, usuarioId: uid, status: de },
      data,
    });
    if (!upd.count)
      throw new AppError("Estado da locação alterado por outra operação", 409);
    if (["devolver", "cancelar"].includes(acao)) {
      await tx.veiculo.updateMany({
        where: {
          id: l.veiculoId,
          status: acao === "devolver" ? "alugado" : "reservado",
        },
        data: { status: "disponivel" },
      });
      // Se a frota foi marcada como manutenção/inativa durante a locação,
      // encerre a locação sem sobrescrever a decisão operacional do ADMIN.
    }
    if (acao === "retirar") {
      const veiculoAtualizado = await tx.veiculo.updateMany({
        where: { id: l.veiculoId, status: "reservado" },
        data: { status: "alugado" },
      });
      if (!veiculoAtualizado.count)
        throw new AppError("Veículo não está reservado para retirada", 409);
    }
    const result = await tx.locacao.findUnique({
      where: { id: l.id },
      include: { veiculo: true },
    });
    return acao === "cancelar"
      ? { ...result, multaCancelamentoCalculada }
      : result;
  });
}
async function finalizar(uid, id) {
  return transicionar(uid, id, "finalizar");
}
module.exports = {
  criar,
  listarDoUsuario,
  buscarDoUsuario,
  finalizar,
  transicionar,
  reservarVeiculo,
  calcularValorTotal,
  transicoes,
};
