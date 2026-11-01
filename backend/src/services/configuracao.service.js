const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");
const CAMPOS = [
  "periodoMinimoDiarias",
  "periodoMaximoDiarias",
  "horarioRetiradaPadrao",
  "horarioDevolucaoPadrao",
  "toleranciaAtrasoMinutos",
  "antecedenciaMinimaHoras",
  "antecedenciaMaximaDias",
  "cancelamentoPrazoHoras",
  "cancelamentoMultaPercentual",
  "idadeMinima",
  "tempoMinimoCnhMeses",
  "documentosExigidos",
  "exigeCartaoCredito",
  "permiteMotoristaAdicional",
  "maxMotoristasAdicionais",
  "kmLivre",
  "kmFranquiaDiaria",
  "politicaCombustivel",
  "permiteDevolucaoOutraFilial",
  "permiteEntregaDomicilio",
  "permiteRetiradaAeroporto",
  "raioEntregaKm",
  "protecaoBasicaInclusa",
  "exigeVistoriaSaida",
  "exigeVistoriaEntrada",
  "modeloContrato",
];
const defaults = {
  periodoMinimoDiarias: 1,
  periodoMaximoDiarias: 30,
  horarioRetiradaPadrao: "09:00:00",
  horarioDevolucaoPadrao: "09:00:00",
  toleranciaAtrasoMinutos: 30,
  antecedenciaMinimaHoras: 0,
  antecedenciaMaximaDias: 365,
  cancelamentoPrazoHoras: 24,
  cancelamentoMultaPercentual: 0,
  idadeMinima: 21,
  tempoMinimoCnhMeses: 12,
  documentosExigidos: ["CNH válida", "Documento de identidade"],
  exigeCartaoCredito: true,
  permiteMotoristaAdicional: false,
  maxMotoristasAdicionais: 0,
  kmLivre: true,
  kmFranquiaDiaria: null,
  politicaCombustivel: "mesmo_nivel",
  permiteDevolucaoOutraFilial: false,
  permiteEntregaDomicilio: false,
  permiteRetiradaAeroporto: false,
  raioEntregaKm: null,
  protecaoBasicaInclusa: true,
  exigeVistoriaSaida: true,
  exigeVistoriaEntrada: true,
  modeloContrato: null,
};
const intRanges = {
  periodoMinimoDiarias: [1, 255],
  periodoMaximoDiarias: [1, 65535],
  toleranciaAtrasoMinutos: [0, 65535],
  antecedenciaMinimaHoras: [0, 65535],
  antecedenciaMaximaDias: [0, 65535],
  cancelamentoPrazoHoras: [0, 65535],
  idadeMinima: [18, 120],
  tempoMinimoCnhMeses: [0, 65535],
  maxMotoristasAdicionais: [0, 255],
  kmFranquiaDiaria: [0, 4294967295],
  raioEntregaKm: [0, 65535],
};
function horaBanco(s) {
  return new Date(`1970-01-01T${s.length === 5 ? s + ":00" : s}.000Z`);
}
function valida(b) {
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw new AppError("Corpo inválido", 400);
  const allowed = new Set([
    ...CAMPOS,
    "filiaisRetirada",
    "filiaisDevolucao",
    "protecoes",
    "franquiasCategoria",
    "caucoesCategoria",
    "checklistItens",
    "catalogos",
  ]);
  for (const k of Object.keys(b))
    if (!allowed.has(k)) throw new AppError(`Campo não permitido: ${k}`, 400);
  const d = { ...defaults };
  for (const k of CAMPOS) {
    if (!(k in b)) throw new AppError(`Campo obrigatório: ${k}`, 400);
    d[k] = b[k];
  }
  for (const [k, [min, max]] of Object.entries(intRanges))
    if (d[k] !== null && (!Number.isInteger(d[k]) || d[k] < min || d[k] > max))
      throw new AppError(`${k} inválido`, 400);
  if (d.periodoMinimoDiarias > d.periodoMaximoDiarias)
    throw new AppError("Período mínimo não pode exceder máximo", 400);
  for (const k of [
    "exigeCartaoCredito",
    "permiteMotoristaAdicional",
    "kmLivre",
    "permiteDevolucaoOutraFilial",
    "permiteEntregaDomicilio",
    "permiteRetiradaAeroporto",
    "protecaoBasicaInclusa",
    "exigeVistoriaSaida",
    "exigeVistoriaEntrada",
  ])
    if (typeof d[k] !== "boolean")
      throw new AppError(`${k} deve ser booleano`, 400);
  if (
    !Array.isArray(d.documentosExigidos) ||
    d.documentosExigidos.some((x) => typeof x !== "string" || !x.trim())
  )
    throw new AppError("documentosExigidos inválido", 400);
  if (
    !["mesmo_nivel", "cobrar_reposicao", "tanque_cheio_pre_pago"].includes(
      d.politicaCombustivel,
    )
  )
    throw new AppError("politicaCombustivel inválida", 400);
  for (const k of ["horarioRetiradaPadrao", "horarioDevolucaoPadrao"])
    if (
      typeof d[k] !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(d[k])
    )
      throw new AppError(`${k} inválido`, 400);
  if (
    !Number.isFinite(Number(d.cancelamentoMultaPercentual)) ||
    Number(d.cancelamentoMultaPercentual) < 0 ||
    Number(d.cancelamentoMultaPercentual) > 100
  )
    throw new AppError("cancelamentoMultaPercentual inválido", 400);
  for (const k of ["raioEntregaKm"])
    if (d[k] !== null && (!Number.isFinite(Number(d[k])) || Number(d[k]) < 0))
      throw new AppError(`${k} inválido`, 400);
  if (d.modeloContrato !== null && typeof d.modeloContrato !== "string")
    throw new AppError("modeloContrato inválido", 400);
  for (const k of ["filiaisRetirada", "filiaisDevolucao"])
    if (
      !Array.isArray(b[k]) ||
      b[k].some((x) => !Number.isInteger(x) || x <= 0) ||
      new Set(b[k]).size !== b[k].length
    )
      throw new AppError(`${k} inválido`, 400);
  if (
    !Array.isArray(b.protecoes) ||
    !Array.isArray(b.franquiasCategoria) ||
    !Array.isArray(b.caucoesCategoria) ||
    !Array.isArray(b.checklistItens)
  )
    throw new AppError("Coleções relacionais obrigatórias", 400);
  if (
    b.protecoes.some(
      (x) =>
        !x ||
        typeof x.nome !== "string" ||
        !x.nome.trim() ||
        x.nome.trim().length > 80 ||
        (x.descricao !== null &&
          x.descricao !== undefined &&
          (typeof x.descricao !== "string" || x.descricao.length > 2000)) ||
        typeof x.ativo !== "boolean" ||
        typeof x.selecionada !== "boolean" ||
        (x.id !== undefined && (!Number.isInteger(x.id) || x.id <= 0)),
    )
  )
    throw new AppError("Proteção inválida", 400);
  if (
    b.checklistItens.some(
      (x) =>
        !x ||
        typeof x.descricao !== "string" ||
        !x.descricao.trim() ||
        x.descricao.trim().length > 120 ||
        !Number.isInteger(x.ordem) ||
        x.ordem < 0 ||
        x.ordem > 255 ||
        typeof x.obrigatorio !== "boolean" ||
        typeof x.ativo !== "boolean" ||
        (x.id !== undefined && (!Number.isInteger(x.id) || x.id <= 0)),
    )
  )
    throw new AppError("Checklist inválido", 400);
  for (const rows of [b.franquiasCategoria, b.caucoesCategoria])
    if (
      rows.some((x) => {
        const valor = Number(x?.valor);
        return (
          !x ||
          !Number.isInteger(x.categoriaId) ||
          x.categoriaId <= 0 ||
          !Number.isFinite(valor) ||
          valor < 0 ||
          valor > 99999999.99 ||
          Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-7
        );
      }) ||
      new Set(rows.map((x) => x.categoriaId)).size !== rows.length
    )
      throw new AppError("Valores por categoria inválidos", 400);
  return d;
}
async function obter() {
  await prisma.configuracaoLocacao.upsert({
    where: { id: 1 },
    create: { id: 1, documentosExigidos: defaults.documentosExigidos },
    update: {},
  });
  const c = await prisma.configuracaoLocacao.findUnique({
    where: { id: 1 },
    include: {
      filiais: { include: { filial: true } },
      protecoes: { include: { protecao: true } },
      franquias: { include: { categoria: true } },
      caucoes: { include: { categoria: true } },
      checklist: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
    },
  });
  const [filiais, categorias] = await Promise.all([
    prisma.filial.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.categoriaVeiculo.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  const {
    filiais: fs,
    protecoes: ps,
    franquias: fr,
    caucoes: ca,
    checklist,
    ...sc
  } = c;
  return {
    ...sc,
    horarioRetiradaPadrao: sc.horarioRetiradaPadrao.toISOString().slice(11, 19),
    horarioDevolucaoPadrao: sc.horarioDevolucaoPadrao
      .toISOString()
      .slice(11, 19),
    documentosExigidos: Array.isArray(c.documentosExigidos)
      ? c.documentosExigidos
      : [],
    filiaisRetirada: fs
      .filter((x) => x.tipo === "retirada")
      .map((x) => x.filialId),
    filiaisDevolucao: fs
      .filter((x) => x.tipo === "devolucao")
      .map((x) => x.filialId),
    protecoes: await prisma.protecao
      .findMany({ orderBy: { id: "asc" } })
      .then((all) =>
        all.map((x) => ({
          ...x,
          selecionada: ps.some((y) => y.protecaoId === x.id && y.selecionada),
        })),
      ),
    franquiasCategoria: fr.map((x) => ({
      categoriaId: x.categoriaId,
      valor: x.valor,
      categoriaNome: x.categoria.nome,
    })),
    caucoesCategoria: ca.map((x) => ({
      categoriaId: x.categoriaId,
      valor: x.valor,
      categoriaNome: x.categoria.nome,
    })),
    checklistItens: checklist,
    catalogos: { filiais, categorias },
  };
}
async function atualizar(b) {
  const d = valida(b);
  return prisma
    .$transaction(async (tx) => {
      const filialIds = [...b.filiaisRetirada, ...b.filiaisDevolucao];
      const catIds = [...b.franquiasCategoria, ...b.caucoesCategoria].map(
        (x) => x.categoriaId,
      );
      if (
        filialIds.length &&
        (await tx.filial.count({ where: { id: { in: filialIds } } })) !==
          new Set(filialIds).size
      )
        throw new AppError("Filial inexistente", 400);
      if (
        catIds.some((x) => !Number.isInteger(x) || x <= 0) ||
        (catIds.length &&
          (await tx.categoriaVeiculo.count({
            where: { id: { in: catIds } },
          })) !== new Set(catIds).size)
      )
        throw new AppError("Categoria inválida", 400);
      const protIds = b.protecoes
        .filter((x) => x.id !== undefined)
        .map((x) => x.id);
      if (
        protIds.some((x) => !Number.isInteger(x) || x <= 0) ||
        new Set(protIds).size !== protIds.length ||
        (protIds.length &&
          (await tx.protecao.count({ where: { id: { in: protIds } } })) !==
            protIds.length)
      )
        throw new AppError("Proteção inválida", 400);
      const checklist = b.checklistItens;
      const checklistIds = checklist
        .filter((x) => x.id !== undefined)
        .map((x) => x.id);
      if (
        new Set(checklistIds).size !== checklistIds.length ||
        (checklistIds.length &&
          (await tx.checklistItem.count({
            where: { id: { in: checklistIds }, configId: 1 },
          })) !== checklistIds.length)
      )
        throw new AppError("Item de checklist inexistente", 400);
      const {
        filiaisRetirada,
        filiaisDevolucao,
        protecoes,
        franquiasCategoria,
        caucoesCategoria,
        checklistItens,
        catalogos,
        ...scalar
      } = b;
      d.horarioRetiradaPadrao = horaBanco(d.horarioRetiradaPadrao);
      d.horarioDevolucaoPadrao = horaBanco(d.horarioDevolucaoPadrao);
      await tx.configuracaoLocacao.upsert({
        where: { id: 1 },
        create: { id: 1, ...d },
        update: d,
      });
      await tx.configFilial.deleteMany({ where: { configId: 1 } });
      await tx.configFilial.createMany({
        data: [
          ...filiaisRetirada.map((filialId) => ({
            configId: 1,
            filialId,
            tipo: "retirada",
          })),
          ...filiaisDevolucao.map((filialId) => ({
            configId: 1,
            filialId,
            tipo: "devolucao",
          })),
        ],
      });
      await tx.protecaoConfig.deleteMany({ where: { configId: 1 } });
      const protecoesSalvas = [];
      for (const protecao of protecoes) {
        const dadosProtecao = {
          nome: protecao.nome.trim(),
          descricao: protecao.descricao?.trim() || null,
          ativo: protecao.ativo,
        };
        const salva = protecao.id
          ? await tx.protecao.update({
              where: { id: protecao.id },
              data: dadosProtecao,
            })
          : await tx.protecao.create({ data: dadosProtecao });
        protecoesSalvas.push({
          configId: 1,
          protecaoId: salva.id,
          selecionada: protecao.selecionada,
        });
      }
      if (protecoesSalvas.length)
        await tx.protecaoConfig.createMany({
          data: protecoesSalvas,
        });
      for (const [model, rows] of [
        [tx.franquiaCategoria, franquiasCategoria],
        [tx.caucaoCategoria, caucoesCategoria],
      ]) {
        await model.deleteMany({ where: { configId: 1 } });
        if (rows.length)
          await model.createMany({
            data: rows.map((x) => ({
              configId: 1,
              categoriaId: x.categoriaId,
              valor: Number(x.valor),
            })),
          });
      }
      await tx.checklistItem.updateMany({
        where: {
          configId: 1,
          ...(checklistIds.length ? { id: { notIn: checklistIds } } : {}),
        },
        data: { ativo: false },
      });
      for (const x of checklistItens) {
        if (x.id)
          await tx.checklistItem.updateMany({
            where: { id: x.id, configId: 1 },
            data: {
              descricao: x.descricao.trim(),
              obrigatorio: x.obrigatorio,
              ordem: x.ordem,
              ativo: x.ativo,
            },
          });
        else
          await tx.checklistItem.create({
            data: {
              configId: 1,
              descricao: x.descricao.trim(),
              obrigatorio: x.obrigatorio,
              ordem: x.ordem,
              ativo: x.ativo,
            },
          });
      }
      return true;
    })
    .then(() => obter());
}
module.exports = { obter, atualizar, valida, defaults };
