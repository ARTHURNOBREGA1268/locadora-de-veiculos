const Decimal = require("decimal.js");
const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");
const calculo = require("./precificacao.calculo");

const CONFIG_CAMPOS = [
  "ocupacaoAlvoPercentual", "margemDesejadaPercentual", "custoAdministrativoMensal", "kmMedioDiario",
  "limpezaPorLocacao", "diasMediosLocacao", "comissaoPercentual", "taxaPagamentoPercentual",
  "valorKmExcedente", "taxaReposicaoCombustivel", "taxaCombustivelPorLitro", "taxaLimpeza",
  "taxaAeroporto", "taxaOutraFilial", "taxaEntregaDomicilioFixa", "taxaEntregaPorKm",
  "atrasoToleranciaMinutos", "atrasoValorHoraPercentual", "atrasoLimiteHorasViraDiaria",
  "multaCancelamentoPercentual", "taxaAdminMultaTransito", "issPercentual", "taxaCartaoPercentual",
  "parcelamentoMax", "parcelamentoJurosPercentual", "precoMinimoMargemPercentual",
];
const CUSTO_CAMPOS = ["custoCapitalMensal", "ipvaAnual", "seguroAnual", "licenciamentoAnual", "manutencaoPorKm"];
const TARIFA_CAMPOS = ["categoriaId", "valorDiaria", "valorSemanal", "valorMensal", "vigenciaInicio", "vigenciaFim", "ativo"];
const REGRA_CAMPOS = ["nome", "tipo", "categoriaId", "dataInicio", "dataFim", "diasSemana", "antecedenciaMinDias", "antecedenciaMaxDias", "ocupacaoMinPercentual", "duracaoMinDiarias", "tipoAjuste", "valorAjuste", "prioridade", "acumulavel", "ativo"];
const ADICIONAL_CAMPOS = ["nome", "tipoCobranca", "valor", "valorMaximoLocacao", "ativo"];
const PROTECAO_CAMPOS = ["protecaoId", "categoriaId", "valorDiaria", "ativo"];
const PROMOCAO_CAMPOS = ["codigoCupom", "descricao", "tipoDesconto", "valorDesconto", "vigenciaInicio", "vigenciaFim", "limiteUsosTotal", "limiteUsosPorCliente", "categoriaId", "convenioId", "acumulavel", "ativo"];
const NIVEL_CAMPOS = ["nome", "locacoesMinimas", "descontoPercentual", "ativo"];
const TIPOS_REGRA = ["sazonalidade", "dia_semana", "antecedencia", "ocupacao", "duracao"];
const DECIMAL = Decimal;

function objeto(value, nome = "Corpo") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError(`${nome} inválido`, 400);
  return value;
}
function idValido(value, campo = "id") {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError(`${campo} inválido`, 400);
  return n;
}
function decimalValue(value, campo, { nullable = false, min = null, max = null, scale = 2 } = {}) {
  if ((value === null || value === undefined || value === "") && nullable) return null;
  let result;
  try { result = new Decimal(value); } catch { throw new AppError(`${campo} inválido`, 400); }
  if (!result.isFinite() || (min !== null && result.lt(min)) || (max !== null && result.gt(max)) || result.decimalPlaces() > scale)
    throw new AppError(`${campo} inválido`, 400);
  return result;
}
function inteiro(value, campo, min = 0, max = 2147483647, nullable = false) {
  if ((value === null || value === undefined) && nullable) return null;
  if (!Number.isInteger(value) || value < min || value > max) throw new AppError(`${campo} inválido`, 400);
  return value;
}
function booleano(value, campo, nullable = false) {
  if (value === null && nullable) return null;
  if (typeof value !== "boolean") throw new AppError(`${campo} deve ser booleano`, 400);
  return value;
}
function data(value, campo, nullable = false) {
  if ((value === null || value === undefined || value === "") && nullable) return null;
  return calculo.dataUTC(value, campo);
}
function camposPermitidos(body, allowed) {
  for (const key of Object.keys(body)) if (!allowed.includes(key)) throw new AppError(`Campo não permitido: ${key}`, 400);
}
function serializarAuditoria(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value instanceof Decimal || value?.constructor?.name === "Decimal") return value.toString();
  if (typeof value === "object") return JSON.stringify(value).slice(0, 100);
  return String(value).slice(0, 100);
}
async function auditar(tx, usuarioId, tabelaOrigem, registroId, anterior, novo, campos) {
  const rows = [];
  for (const campo of campos) {
    const oldValue = anterior?.[campo] ?? null;
    const newValue = novo?.[campo] ?? null;
    if (serializarAuditoria(oldValue) === serializarAuditoria(newValue)) continue;
    rows.push({ tabelaOrigem, registroId, campo, valorAnterior: serializarAuditoria(oldValue), valorNovo: serializarAuditoria(newValue), usuarioId });
  }
  if (rows.length) await tx.historicoTarifa.createMany({ data: rows });
}
async function obterConfig(tx = prisma) {
  return tx.configuracaoPrecificacao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}
async function pisoMinimoCategoria(tx, categoriaId, config) {
  const [pisoCategoria, veiculos] = await Promise.all([
    tx.precoPisoCategoria.findUnique({ where: { categoriaId } }),
    tx.veiculo.findMany({
      where: { categoriaId, status: { not: "inativo" } },
      select: { valorCompra: true, valorRevendaEstimado: true, vidaUtilMeses: true, custosPrecificacao: true },
    }),
  ]);
  let piso = new Decimal(pisoCategoria?.valor ?? 0);
  for (const veiculo of veiculos) {
    const custo = calculo.calcularCustoMinimo(veiculo, veiculo.custosPrecificacao, config);
    if (!custo.completo) continue;
    let minimo = custo.minimoDiario;
    if (config.precoMinimoMargemPercentual !== null && config.precoMinimoMargemPercentual !== undefined) {
      const margemMinima = new Decimal(config.precoMinimoMargemPercentual).div(100);
      const minimoMargem = new Decimal(custo.componentes.custoPorDiariaAlugada)
        .div(new Decimal(1).minus(margemMinima))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (minimoMargem.gt(minimo)) minimo = minimoMargem;
    }
    if (minimo.gt(piso)) piso = minimo;
  }
  return piso.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
async function obterAdmin() {
  const config = await obterConfig();
  const [categorias, veiculos, tarifasBase, regras, adicionais, protecoes, catalogoProtecoes, promocoes, niveis, pisos, historico, convenios] = await Promise.all([
    prisma.categoriaVeiculo.findMany({ orderBy: { nome: "asc" } }),
    prisma.veiculo.findMany({ where: { status: { not: "inativo" } }, include: { categoria: true, custosPrecificacao: true }, orderBy: { id: "asc" } }),
    prisma.tarifaBase.findMany({ include: { categoria: true }, orderBy: [{ categoriaId: "asc" }, { vigenciaInicio: "desc" }] }),
    prisma.regraPreco.findMany({ include: { categoria: true }, orderBy: [{ prioridade: "asc" }, { id: "asc" }] }),
    prisma.adicional.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.protecaoPreco.findMany({ include: { protecao: true, categoria: true }, orderBy: [{ protecaoId: "asc" }, { categoriaId: "asc" }] }),
    prisma.protecao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.promocao.findMany({ include: { categoria: true, convenio: true }, orderBy: { id: "desc" } }),
    prisma.nivelFidelidade.findMany({ orderBy: { locacoesMinimas: "asc" } }),
    prisma.precoPisoCategoria.findMany({ include: { categoria: true }, orderBy: { categoriaId: "asc" } }),
    prisma.historicoTarifa.findMany({ include: { usuario: { select: { id: true, nome: true, email: true } } }, orderBy: { alteradoEm: "desc" }, take: 100 }),
    prisma.convenio.findMany({ orderBy: { nome: "asc" } }),
  ]);
  const veiculosComRecomendacao = veiculos.map((veiculo) => {
    const custo = calculo.calcularCustoMinimo(veiculo, veiculo.custosPrecificacao, config);
    let diariaMinima = custo.completo ? custo.minimoDiario : null;
    if (custo.completo) {
      const margemMinima = config.precoMinimoMargemPercentual;
      if (margemMinima !== null && margemMinima !== undefined) {
        const pisoMargem = new Decimal(custo.componentes.custoPorDiariaAlugada)
          .div(new Decimal(1).minus(new Decimal(margemMinima).div(100)))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        if (pisoMargem.gt(diariaMinima)) diariaMinima = pisoMargem;
      }
      const pisoCategoria = pisos.find((row) => row.categoriaId === veiculo.categoriaId)?.valor;
      if (pisoCategoria !== undefined && new Decimal(pisoCategoria).gt(diariaMinima)) diariaMinima = new Decimal(pisoCategoria);
    }
    return {
      ...veiculo,
      recomendacaoCusto: {
        completo: custo.completo,
        diariaMinima,
        componentes: custo.componentes,
      },
    };
  });
  return { configuracao: config, categorias, veiculos: veiculosComRecomendacao, tarifasBase, regras, adicionais, protecoes, catalogoProtecoes, promocoes, niveisFidelidade: niveis, pisosCategoria: pisos, convenios, historico };
}

async function salvarConfiguracao(body, usuarioId) {
  objeto(body);
  camposPermitidos(body, CONFIG_CAMPOS);
  if (!Object.keys(body).length) throw new AppError("Informe ao menos um campo", 400);
  const d = {};
  const camposMonetarios = new Set(["custoAdministrativoMensal", "limpezaPorLocacao", "valorKmExcedente", "taxaReposicaoCombustivel", "taxaCombustivelPorLitro", "taxaLimpeza", "taxaAeroporto", "taxaOutraFilial", "taxaEntregaDomicilioFixa", "taxaEntregaPorKm", "taxaAdminMultaTransito"]);
  const camposPercentuais = new Set(["ocupacaoAlvoPercentual", "margemDesejadaPercentual", "comissaoPercentual", "taxaPagamentoPercentual", "atrasoValorHoraPercentual", "multaCancelamentoPercentual", "issPercentual", "taxaCartaoPercentual", "parcelamentoJurosPercentual", "precoMinimoMargemPercentual"]);
  const percentRanges = { ocupacaoAlvoPercentual: [0.01, 100], margemDesejadaPercentual: [0, 99.99], comissaoPercentual: [0, 99.99], taxaPagamentoPercentual: [0, 99.99], atrasoValorHoraPercentual: [0, 100], multaCancelamentoPercentual: [0, 100], issPercentual: [0, 100], taxaCartaoPercentual: [0, 100], parcelamentoJurosPercentual: [0, 100], precoMinimoMargemPercentual: [0, 99.99] };
  const inteiros = { kmMedioDiario: [0, 65535], diasMediosLocacao: [1, 65535], atrasoToleranciaMinutos: [0, 65535], atrasoLimiteHorasViraDiaria: [0, 255], parcelamentoMax: [1, 255] };
  for (const [key, value] of Object.entries(body)) {
    if (camposPercentuais.has(key)) {
      const [min, max] = percentRanges[key];
      d[key] = decimalValue(value, key, { nullable: true, min, max });
    } else if (camposMonetarios.has(key)) d[key] = decimalValue(value, key, { nullable: true, min: 0, max: 9999999999.99 });
    else if (inteiros[key]) d[key] = inteiro(value, key, ...inteiros[key], value === null);
  }
  return prisma.$transaction(async (tx) => {
    const old = await obterConfig(tx);
    const saved = await tx.configuracaoPrecificacao.update({ where: { id: 1 }, data: d });
    await auditar(tx, usuarioId, "configuracoes_precificacao", 1, old, saved, Object.keys(d));
    return saved;
  });
}

async function salvarCustos(veiculoId, body, usuarioId) {
  const id = idValido(veiculoId, "veiculoId");
  objeto(body);
  camposPermitidos(body, CUSTO_CAMPOS);
  if (!Object.keys(body).length) throw new AppError("Informe ao menos um custo", 400);
  const d = {};
  for (const key of CUSTO_CAMPOS) if (Object.hasOwn(body, key)) {
    const manutencao = key === "manutencaoPorKm";
    d[key] = decimalValue(body[key], key, { nullable: true, min: 0, max: manutencao ? 999999.9999 : 9999999999.99, scale: manutencao ? 4 : 2 });
  }
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.veiculo.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) throw new AppError("Veículo não encontrado", 404);
    const old = await tx.custoPrecificacaoVeiculo.findUnique({ where: { veiculoId: id } });
    const saved = await tx.custoPrecificacaoVeiculo.upsert({ where: { veiculoId: id }, create: { veiculoId: id, ...d }, update: d });
    await auditar(tx, usuarioId, "custos_precificacao_veiculo", id, old, saved, Object.keys(d));
    return saved;
  });
}

async function verificarCategoria(tx, id, campo = "categoriaId", nullable = false) {
  if (id === null || id === undefined) {
    if (nullable) return null;
    throw new AppError(`${campo} obrigatório`, 400);
  }
  const value = idValido(id, campo);
  if (!(await tx.categoriaVeiculo.findUnique({ where: { id: value }, select: { id: true } }))) throw new AppError("Categoria não encontrada", 400);
  return value;
}
function intervaloSobrepoe(a, b) {
  const aFim = a.vigenciaFim ? a.vigenciaFim.getTime() : Number.POSITIVE_INFINITY;
  const bFim = b.vigenciaFim ? b.vigenciaFim.getTime() : Number.POSITIVE_INFINITY;
  return a.vigenciaInicio.getTime() <= bFim && b.vigenciaInicio.getTime() <= aFim;
}
async function salvarTarifa(idRaw, body, usuarioId) {
  objeto(body);
  camposPermitidos(body, TARIFA_CAMPOS);
  return prisma.$transaction(async (tx) => {
    const id = idRaw === null ? null : idValido(idRaw);
    const old = id ? await tx.tarifaBase.findUnique({ where: { id } }) : null;
    if (id && !old) throw new AppError("Tarifa não encontrada", 404);
    const source = { ...(old || {}), ...body };
    const categoriaId = await verificarCategoria(tx, source.categoriaId);
    const valorDiaria = decimalValue(source.valorDiaria, "valorDiaria", { min: 0.01, max: 99999999.99 });
    const valorSemanal = decimalValue(source.valorSemanal, "valorSemanal", { nullable: true, min: 0.01, max: 99999999.99 });
    const valorMensal = decimalValue(source.valorMensal, "valorMensal", { nullable: true, min: 0.01, max: 99999999.99 });
    const vigenciaInicio = data(source.vigenciaInicio, "vigenciaInicio");
    const vigenciaFim = data(source.vigenciaFim, "vigenciaFim", true);
    if (vigenciaFim && vigenciaFim < vigenciaInicio) throw new AppError("vigenciaFim não pode anteceder vigenciaInicio", 400);
    const ativo = booleano(source.ativo, "ativo");
    if (ativo) {
      const others = await tx.tarifaBase.findMany({ where: { categoriaId, ativo: true, ...(id ? { id: { not: id } } : {}) }, select: { id: true, vigenciaInicio: true, vigenciaFim: true } });
      if (others.some((item) => intervaloSobrepoe(item, { vigenciaInicio, vigenciaFim }))) throw new AppError("Já existe tarifa ativa com vigência sobreposta para esta categoria", 409);
    }
    const d = { categoriaId, valorDiaria, valorSemanal, valorMensal, vigenciaInicio, vigenciaFim, ativo };
    if (ativo) {
      const config = await obterConfig(tx);
      const piso = await pisoMinimoCategoria(tx, categoriaId, config);
      const pacotes = [["diária", valorDiaria, 1], ["semanal", valorSemanal, 7], ["mensal", valorMensal, 30]];
      for (const [nome, total, diarias] of pacotes) {
        if (total === null) continue;
        const diariaPacote = total.div(diarias).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        if (diariaPacote.lt(piso)) throw new AppError(`Tarifa ${nome} abaixo do custo mínimo ou piso da categoria (${piso.toFixed(2)})`, 409);
      }
    }
    const saved = id ? await tx.tarifaBase.update({ where: { id }, data: d }) : await tx.tarifaBase.create({ data: d });
    await auditar(tx, usuarioId, "tarifas_base", saved.id, old, saved, TARIFA_CAMPOS);
    return saved;
  });
}

async function salvarRegra(idRaw, body, usuarioId) {
  objeto(body);
  camposPermitidos(body, REGRA_CAMPOS);
  return prisma.$transaction(async (tx) => {
    const id = idRaw === null ? null : idValido(idRaw);
    const old = id ? await tx.regraPreco.findUnique({ where: { id } }) : null;
    if (id && !old) throw new AppError("Regra não encontrada", 404);
    const v = { ...(old || {}), ...body };
    if (typeof v.nome !== "string" || !v.nome.trim() || v.nome.trim().length > 80) throw new AppError("nome inválido", 400);
    if (!TIPOS_REGRA.includes(v.tipo)) throw new AppError("tipo inválido", 400);
    const categoriaId = await verificarCategoria(tx, v.categoriaId, "categoriaId", true);
    const dataInicio = data(v.dataInicio, "dataInicio", true);
    const dataFim = data(v.dataFim, "dataFim", true);
    if (dataInicio && dataFim && dataFim < dataInicio) throw new AppError("dataFim deve ser igual ou posterior a dataInicio", 400);
    let diasSemana = v.diasSemana ?? null;
    if (diasSemana !== null && (!Array.isArray(diasSemana) || diasSemana.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || new Set(diasSemana).size !== diasSemana.length)) throw new AppError("diasSemana inválido", 400);
    const antecedenciaMinDias = inteiro(v.antecedenciaMinDias, "antecedenciaMinDias", 0, 65535, true);
    const antecedenciaMaxDias = inteiro(v.antecedenciaMaxDias, "antecedenciaMaxDias", 0, 65535, true);
    if (antecedenciaMinDias !== null && antecedenciaMaxDias !== null && antecedenciaMinDias > antecedenciaMaxDias) throw new AppError("Limite mínimo de antecedência maior que o máximo", 400);
    const ocupacaoMinPercentual = decimalValue(v.ocupacaoMinPercentual, "ocupacaoMinPercentual", { nullable: true, min: 0, max: 100 });
    const duracaoMinDiarias = inteiro(v.duracaoMinDiarias, "duracaoMinDiarias", 1, 65535, true);
    if (!['percentual', 'valor_fixo'].includes(v.tipoAjuste)) throw new AppError("tipoAjuste inválido", 400);
    const valorAjuste = decimalValue(v.valorAjuste, "valorAjuste", { min: -99999999.99, max: 99999999.99 });
    if (v.tipoAjuste === "percentual" && valorAjuste.lte(-100)) throw new AppError("Desconto percentual deve ser maior que -100%", 400);
    const prioridade = inteiro(v.prioridade, "prioridade", 0, 255);
    const acumulavel = booleano(v.acumulavel, "acumulavel");
    const ativo = booleano(v.ativo, "ativo");
    if (v.tipo === "sazonalidade" && !dataInicio && !dataFim) throw new AppError("Regra sazonal exige uma data inicial ou final", 400);
    if (v.tipo === "dia_semana" && (!diasSemana || diasSemana.length === 0)) throw new AppError("Regra de dia da semana exige diasSemana", 400);
    if (v.tipo === "antecedencia" && antecedenciaMinDias === null && antecedenciaMaxDias === null) throw new AppError("Regra de antecedência exige ao menos um limite", 400);
    if (v.tipo === "ocupacao" && ocupacaoMinPercentual === null) throw new AppError("Regra de ocupação exige ocupacaoMinPercentual", 400);
    if (v.tipo === "duracao" && duracaoMinDiarias === null) throw new AppError("Regra de duração exige duracaoMinDiarias", 400);
    const d = { nome: v.nome.trim(), tipo: v.tipo, categoriaId, dataInicio, dataFim, diasSemana, antecedenciaMinDias, antecedenciaMaxDias, ocupacaoMinPercentual, duracaoMinDiarias, tipoAjuste: v.tipoAjuste, valorAjuste, prioridade, acumulavel, ativo };
    const saved = id ? await tx.regraPreco.update({ where: { id }, data: d }) : await tx.regraPreco.create({ data: d });
    await auditar(tx, usuarioId, "regras_preco", saved.id, old, saved, REGRA_CAMPOS);
    return saved;
  });
}

async function salvarAdicional(idRaw, body, usuarioId) {
  objeto(body); camposPermitidos(body, ADICIONAL_CAMPOS);
  const id = idRaw === null ? null : idValido(idRaw);
  const old = id ? await prisma.adicional.findUnique({ where: { id } }) : null;
  if (id && !old) throw new AppError("Adicional não encontrado", 404);
  const v = { ...(old || {}), ...body };
  if (typeof v.nome !== "string" || !v.nome.trim() || v.nome.trim().length > 80) throw new AppError("nome inválido", 400);
  if (!["por_diaria", "por_locacao"].includes(v.tipoCobranca)) throw new AppError("tipoCobranca inválido", 400);
  const d = { nome: v.nome.trim(), tipoCobranca: v.tipoCobranca, valor: decimalValue(v.valor, "valor", { min: 0, max: 99999999.99 }), valorMaximoLocacao: decimalValue(v.valorMaximoLocacao, "valorMaximoLocacao", { nullable: true, min: 0, max: 99999999.99 }), ativo: booleano(v.ativo, "ativo") };
  return prisma.$transaction(async (tx) => {
    const saved = id ? await tx.adicional.update({ where: { id }, data: d }) : await tx.adicional.create({ data: d });
    await auditar(tx, usuarioId, "adicionais", saved.id, old, saved, ADICIONAL_CAMPOS);
    return saved;
  });
}

async function salvarProtecao(idRaw, body, usuarioId) {
  objeto(body); camposPermitidos(body, PROTECAO_CAMPOS);
  return prisma.$transaction(async (tx) => {
    const id = idRaw === null ? null : idValido(idRaw);
    const old = id ? await tx.protecaoPreco.findUnique({ where: { id } }) : null;
    if (id && !old) throw new AppError("Preço de proteção não encontrado", 404);
    const v = { ...(old || {}), ...body };
    const protecaoId = idValido(v.protecaoId, "protecaoId");
    if (!(await tx.protecao.findUnique({ where: { id: protecaoId }, select: { id: true } }))) throw new AppError("Proteção não encontrada", 400);
    const categoriaId = await verificarCategoria(tx, v.categoriaId, "categoriaId", true);
    const valorDiaria = decimalValue(v.valorDiaria, "valorDiaria", { min: 0, max: 99999999.99 });
    const ativo = booleano(v.ativo, "ativo");
    if (ativo) {
      const duplicate = await tx.protecaoPreco.findFirst({ where: { protecaoId, categoriaId, ativo: true, ...(id ? { id: { not: id } } : {}) } });
      if (duplicate) throw new AppError("Já existe preço ativo para esta proteção e categoria", 409);
    }
    const d = { protecaoId, categoriaId, valorDiaria, ativo };
    const saved = id ? await tx.protecaoPreco.update({ where: { id }, data: d }) : await tx.protecaoPreco.create({ data: d });
    await auditar(tx, usuarioId, "protecoes_preco", saved.id, old, saved, PROTECAO_CAMPOS);
    return saved;
  });
}

async function salvarPromocao(idRaw, body, usuarioId) {
  objeto(body); camposPermitidos(body, PROMOCAO_CAMPOS);
  return prisma.$transaction(async (tx) => {
    const id = idRaw === null ? null : idValido(idRaw);
    const old = id ? await tx.promocao.findUnique({ where: { id } }) : null;
    if (id && !old) throw new AppError("Promoção não encontrada", 404);
    const v = { ...(old || {}), ...body };
    if (typeof v.codigoCupom !== "string" || !v.codigoCupom.trim() || v.codigoCupom.trim().length > 30) throw new AppError("codigoCupom inválido", 400);
    if (typeof v.descricao !== "string" || !v.descricao.trim() || v.descricao.trim().length > 120) throw new AppError("descricao inválida", 400);
    if (!["percentual", "valor_fixo"].includes(v.tipoDesconto)) throw new AppError("tipoDesconto inválido", 400);
    const valorDesconto = decimalValue(v.valorDesconto, "valorDesconto", { min: 0.01, max: 99999999.99 });
    if (v.tipoDesconto === "percentual" && valorDesconto.gt(100)) throw new AppError("Desconto percentual não pode exceder 100%", 400);
    const vigenciaInicio = data(v.vigenciaInicio, "vigenciaInicio");
    const vigenciaFim = data(v.vigenciaFim, "vigenciaFim");
    if (vigenciaFim < vigenciaInicio) throw new AppError("vigenciaFim deve ser igual ou posterior a vigenciaInicio", 400);
    const limiteUsosTotal = inteiro(v.limiteUsosTotal, "limiteUsosTotal", 1, 4294967295, true);
    const limiteUsosPorCliente = inteiro(v.limiteUsosPorCliente, "limiteUsosPorCliente", 1, 65535, true);
    const categoriaId = await verificarCategoria(tx, v.categoriaId, "categoriaId", true);
    let convenioId = v.convenioId === null || v.convenioId === undefined ? null : idValido(v.convenioId, "convenioId");
    if (convenioId && !(await tx.convenio.findUnique({ where: { id: convenioId }, select: { id: true, ativo: true } }))?.ativo) throw new AppError("Convênio inválido ou inativo", 400);
    const acumulavel = booleano(v.acumulavel, "acumulavel");
    const ativo = booleano(v.ativo, "ativo");
    const d = { codigoCupom: v.codigoCupom.trim().toUpperCase(), descricao: v.descricao.trim(), tipoDesconto: v.tipoDesconto, valorDesconto, vigenciaInicio, vigenciaFim, limiteUsosTotal, limiteUsosPorCliente, categoriaId, convenioId, acumulavel, ativo };
    let saved;
    try { saved = id ? await tx.promocao.update({ where: { id }, data: d }) : await tx.promocao.create({ data: d }); }
    catch (error) { if (error.code === "P2002") throw new AppError("Código de cupom já cadastrado", 409); throw error; }
    await auditar(tx, usuarioId, "promocoes", saved.id, old, saved, PROMOCAO_CAMPOS);
    return saved;
  });
}

async function salvarNivel(idRaw, body, usuarioId) {
  objeto(body); camposPermitidos(body, NIVEL_CAMPOS);
  return prisma.$transaction(async (tx) => {
    const id = idRaw === null ? null : idValido(idRaw);
    const old = id ? await tx.nivelFidelidade.findUnique({ where: { id } }) : null;
    if (id && !old) throw new AppError("Nível de fidelidade não encontrado", 404);
    const v = { ...(old || {}), ...body };
    if (typeof v.nome !== "string" || !v.nome.trim() || v.nome.trim().length > 40) throw new AppError("nome inválido", 400);
    const locacoesMinimas = inteiro(v.locacoesMinimas, "locacoesMinimas", 1, 65535);
    const descontoPercentual = decimalValue(v.descontoPercentual, "descontoPercentual", { min: 0, max: 99.99 });
    const ativo = booleano(v.ativo, "ativo");
    const d = { nome: v.nome.trim(), locacoesMinimas, descontoPercentual, ativo };
    let saved;
    try { saved = id ? await tx.nivelFidelidade.update({ where: { id }, data: d }) : await tx.nivelFidelidade.create({ data: d }); }
    catch (error) { if (error.code === "P2002") throw new AppError("Já existe nível com essa quantidade mínima de locações", 409); throw error; }
    await auditar(tx, usuarioId, "niveis_fidelidade", saved.id, old, saved, NIVEL_CAMPOS);
    return saved;
  });
}

async function salvarPiso(categoriaRaw, body, usuarioId) {
  objeto(body); camposPermitidos(body, ["valor"]);
  return prisma.$transaction(async (tx) => {
    const categoriaId = await verificarCategoria(tx, categoriaRaw);
    const valor = decimalValue(body.valor, "valor", { min: 0, max: 99999999.99 });
    const old = await tx.precoPisoCategoria.findUnique({ where: { categoriaId } });
    const saved = await tx.precoPisoCategoria.upsert({ where: { categoriaId }, create: { categoriaId, valor }, update: { valor } });
    await auditar(tx, usuarioId, "precos_piso_categoria", categoriaId, old, saved, ["valor"]);
    return saved;
  });
}

async function listarHistorico({ origem, registroId, limit = 100 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 100, 1), 200);
  return prisma.historicoTarifa.findMany({
    where: { ...(origem ? { tabelaOrigem: String(origem).slice(0, 40) } : {}), ...(registroId ? { registroId: idValido(registroId, "registroId") } : {}) },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
    orderBy: [{ alteradoEm: "desc" }, { id: "desc" }], take,
  });
}

async function obterOpcoes(veiculoRaw) {
  const veiculoId = idValido(veiculoRaw, "veiculoId");
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true, categoriaId: true, status: true } });
  if (!veiculo) throw new AppError("Veículo não encontrado", 404);
  if (veiculo.status !== "disponivel") throw new AppError("Veículo indisponível para cotação", 409);
  const locacaoAtiva = await prisma.locacao.findFirst({ where: { veiculoId, status: { in: ["reservada", "retirada", "em_andamento"] } }, select: { id: true } });
  if (locacaoAtiva) throw new AppError("Veículo possui locação ativa", 409);
  const [adicionais, precosProtecao, caucao, config, convenios] = await Promise.all([
    prisma.adicional.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.protecaoPreco.findMany({ where: { ativo: true, OR: [{ categoriaId: veiculo.categoriaId }, { categoriaId: null }] }, include: { protecao: true }, orderBy: { id: "asc" } }),
    prisma.caucaoCategoria.findUnique({ where: { configId_categoriaId: { configId: 1, categoriaId: veiculo.categoriaId } } }),
    obterConfig(),
    prisma.convenio.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const byProtection = new Map();
  for (const row of precosProtecao) {
    if (!row.protecao.ativo) continue;
    const rows = byProtection.get(row.protecaoId) || [];
    rows.push(row);
    byProtection.set(row.protecaoId, rows);
  }
  const protecoes = [...byProtection.entries()].flatMap(([protecaoId, rows]) => {
    const especificas = rows.filter((row) => row.categoriaId === veiculo.categoriaId);
    const aplicaveis = especificas.length ? especificas : rows.filter((row) => row.categoriaId === null);
    if (aplicaveis.length !== 1) return [];
    const row = aplicaveis[0];
    return [{ id: protecaoId, nome: row.protecao.nome, descricao: row.protecao.descricao, valorDiaria: row.valorDiaria }];
  });
  return {
    adicionais,
    protecoes,
    convenios,
    valorCaucao: caucao?.valor ?? null,
    taxasDisponiveis: {
      taxaReposicaoCombustivel: config.taxaReposicaoCombustivel,
      taxaCombustivelPorLitro: config.taxaCombustivelPorLitro,
      taxaLimpeza: config.taxaLimpeza,
      taxaAeroporto: config.taxaAeroporto,
      taxaOutraFilial: config.taxaOutraFilial,
      taxaEntregaDomicilioFixa: config.taxaEntregaDomicilioFixa,
      taxaEntregaPorKm: config.taxaEntregaPorKm,
      parcelamentoMax: config.parcelamentoMax,
    },
  };
}

async function calcularOcupacao(tx, categoriaId, inicio, fim, qtdDiarias) {
  const veiculos = await tx.veiculo.findMany({ where: { categoriaId, status: { notIn: ["inativo", "manutencao"] } }, select: { id: true } });
  if (!veiculos.length) return 0;
  const locacoes = await tx.locacao.findMany({
    where: { veiculoId: { in: veiculos.map((x) => x.id) }, status: { in: ["reservada", "retirada", "em_andamento"] }, dataInicio: { lt: fim }, dataPrevistaDevolucao: { gt: inicio } },
    select: { dataInicio: true, dataPrevistaDevolucao: true },
  });
  const occupiedDays = locacoes.reduce((sum, locacao) => {
    const overlap = Math.max(0, Math.min(fim.getTime(), locacao.dataPrevistaDevolucao.getTime()) - Math.max(inicio.getTime(), locacao.dataInicio.getTime()));
    return sum + overlap / (24 * 60 * 60 * 1000);
  }, 0);
  const capacity = veiculos.length * qtdDiarias;
  return Math.min(100, capacity ? (occupiedDays / capacity) * 100 : 0);
}

async function prepararCotacao(tx, usuarioId, body) {
  objeto(body, "Dados da cotação");
  camposPermitidos(body, ["veiculoId", "dataInicio", "dataPrevistaDevolucao", "adicionais", "protecoes", "cupom", "convenioId", "taxas", "formaPagamento", "parcelas"]);
  const veiculoId = idValido(body.veiculoId, "veiculoId");
  const { inicio, fim, inicioData, qtdDiarias } = calculo.calcularQuantidadeDiarias(body.dataInicio, body.dataPrevistaDevolucao);
  const veiculo = await tx.veiculo.findUnique({ where: { id: veiculoId }, include: { categoria: true, custosPrecificacao: true } });
  if (!veiculo) throw new AppError("Veículo não encontrado", 404);
  if (veiculo.status !== "disponivel") throw new AppError("Veículo indisponível para cotação", 409);
  const locacaoAtiva = await tx.locacao.findFirst({ where: { veiculoId, status: { in: ["reservada", "retirada", "em_andamento"] } }, select: { id: true } });
  if (locacaoAtiva) throw new AppError("Veículo possui locação ativa e não pode ser cotado", 409);
  const config = await obterConfig(tx);
  const tarifas = await tx.tarifaBase.findMany({
    where: { categoriaId: veiculo.categoriaId, ativo: true, vigenciaInicio: { lte: inicioData }, OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: inicioData } }] },
    orderBy: { id: "asc" },
  });
  if (!tarifas.length) throw new AppError("Não existe tarifa ativa vigente para a categoria e data selecionadas", 409);
  if (tarifas.length > 1) throw new AppError("Há tarifas ativas com vigência ambígua para esta categoria", 409);
  const tarifa = tarifas[0];
  const regras = await tx.regraPreco.findMany({ where: { ativo: true, OR: [{ categoriaId: null }, { categoriaId: veiculo.categoriaId }] }, orderBy: [{ prioridade: "asc" }, { id: "asc" }] });
  const ocupacaoPercentual = await calcularOcupacao(tx, veiculo.categoriaId, inicio, fim, qtdDiarias);
  const pisoRow = await tx.precoPisoCategoria.findUnique({ where: { categoriaId: veiculo.categoriaId } });

  const adicionaisIn = body.adicionais ?? [];
  if (!Array.isArray(adicionaisIn) || adicionaisIn.some((item) => !item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0)) throw new AppError("adicionais inválidos", 400);
  const adicionalIds = [...new Set(adicionaisIn.map((item) => Number(item.id)))];
  if (adicionalIds.length !== adicionaisIn.length) throw new AppError("adicional duplicado", 400);
  const adicionalRows = adicionalIds.length ? await tx.adicional.findMany({ where: { id: { in: adicionalIds }, ativo: true } }) : [];
  if (adicionalRows.length !== adicionalIds.length) throw new AppError("Adicional inexistente ou inativo", 400);
  const adicionais = adicionalRows.map((row) => ({ ...row, quantidade: Number(adicionaisIn.find((x) => Number(x.id) === row.id)?.quantidade || 1) }));

  const protecoesIn = body.protecoes ?? [];
  if (!Array.isArray(protecoesIn) || protecoesIn.some((x) => !Number.isInteger(Number(x)) || Number(x) <= 0)) throw new AppError("protecoes inválidas", 400);
  const protecaoIds = [...new Set(protecoesIn.map(Number))];
  if (protecaoIds.length !== protecoesIn.length) throw new AppError("proteção duplicada", 400);
  const protecoes = [];
  for (const protecaoId of protecaoIds) {
    const rows = await tx.protecaoPreco.findMany({ where: { protecaoId, ativo: true, OR: [{ categoriaId: veiculo.categoriaId }, { categoriaId: null }] }, include: { protecao: true } });
    const especificas = rows.filter((x) => x.categoriaId === veiculo.categoriaId);
    const aplicaveis = especificas.length ? especificas : rows.filter((x) => x.categoriaId === null);
    if (aplicaveis.length !== 1) throw new AppError(aplicaveis.length ? "Preço de proteção ambíguo" : "Proteção sem preço ativo para esta categoria", 409);
    protecoes.push({ protecaoId, nome: aplicaveis[0].protecao.nome, valorDiaria: aplicaveis[0].valorDiaria });
  }

  let promocao = null;
  const cupom = typeof body.cupom === "string" ? body.cupom.trim().toUpperCase() : "";
  if (cupom) {
    promocao = await tx.promocao.findUnique({ where: { codigoCupom: cupom } });
    if (!promocao || !promocao.ativo) throw new AppError("Cupom inválido ou inativo", 400);
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (day < promocao.vigenciaInicio || day > promocao.vigenciaFim) throw new AppError("Cupom fora da vigência", 400);
    if (promocao.categoriaId && promocao.categoriaId !== veiculo.categoriaId) throw new AppError("Cupom não aplicável à categoria", 400);
    if (promocao.convenioId && promocao.convenioId !== (body.convenioId ? idValido(body.convenioId, "convenioId") : null)) throw new AppError("Cupom exige convênio elegível", 400);
    if (promocao.limiteUsosTotal !== null && promocao.usosRealizados >= promocao.limiteUsosTotal) throw new AppError("Limite total de uso do cupom atingido", 409);
    if (promocao.limiteUsosPorCliente !== null) {
      if (!usuarioId) throw new AppError("Identificação do cliente obrigatória para este cupom", 400);
      const count = await tx.usoPromocao.count({ where: { promocaoId: promocao.id, usuarioId } });
      if (count >= promocao.limiteUsosPorCliente) throw new AppError("Limite de uso deste cupom por cliente atingido", 409);
    }
  }
  let nivelFidelidade = null;
  if (usuarioId) {
    const concluidas = await tx.locacao.count({ where: { usuarioId, status: "finalizada" } });
    nivelFidelidade = await tx.nivelFidelidade.findFirst({ where: { ativo: true, locacoesMinimas: { lte: concluidas } }, orderBy: { locacoesMinimas: "desc" } });
  }
  const caucaoRow = await tx.caucaoCategoria.findUnique({ where: { configId_categoriaId: { configId: 1, categoriaId: veiculo.categoriaId } } });
  const taxas = body.taxas ?? {};
  objeto(taxas, "taxas");
  const taxasBooleanas = ["reporCombustivel", "limpeza", "aeroporto", "outraFilial", "entregaDomicilio"];
  const taxasNumericas = ["kmExcedente", "litrosCombustivel", "distanciaEntregaKm"];
  camposPermitidos(taxas, [...taxasBooleanas, ...taxasNumericas]);
  for (const field of taxasBooleanas) if (Object.hasOwn(taxas, field)) booleano(taxas[field], `taxas.${field}`);
  for (const field of taxasNumericas) if (Object.hasOwn(taxas, field)) decimalValue(taxas[field], `taxas.${field}`, { min: 0, max: 99999999.99 });
  const result = calculo.calcularPreco({
    veiculo, custoVeiculo: veiculo.custosPrecificacao, config, tarifa, regras, adicionais, protecoes, promocao, nivelFidelidade,
    ocupacaoPercentual, categoriaPiso: pisoRow?.valor ?? null,
    dataInicio: inicio, dataDevolucao: fim,
    taxas, formaPagamento: body.formaPagamento ?? null, parcelas: body.parcelas ?? 1, caucao: caucaoRow?.valor ?? null,
  });
  return { ...result, promocaoId: promocao?.id ?? null, usuarioId: usuarioId ?? null };
}
async function cotar(body, usuarioId) {
  return prisma.$transaction((tx) => prepararCotacao(tx, usuarioId, body), { isolationLevel: "Serializable" });
}
async function salvarSnapshot(tx, locacaoId, quote, usuarioId) {
  const id = idValido(locacaoId, "locacaoId");
  if (quote.promocaoId) {
    const promo = await tx.promocao.findUnique({ where: { id: quote.promocaoId } });
    if (!promo || !promo.ativo) throw new AppError("Cupom não está mais ativo", 409);
    const where = { id: promo.id, ativo: true, ...(promo.limiteUsosTotal !== null ? { usosRealizados: { lt: promo.limiteUsosTotal } } : {}) };
    const changed = await tx.promocao.updateMany({ where, data: { usosRealizados: { increment: 1 } } });
    if (!changed.count) throw new AppError("Limite de uso do cupom atingido durante a confirmação", 409);
    if (promo.limiteUsosPorCliente !== null) {
      const count = await tx.usoPromocao.count({ where: { promocaoId: promo.id, usuarioId } });
      if (count >= promo.limiteUsosPorCliente) throw new AppError("Limite por cliente atingido durante a confirmação", 409);
    }
    await tx.usoPromocao.create({ data: { promocaoId: promo.id, usuarioId, locacaoId: id, descontoAplicado: quote.detalhes.descontoPromocao.valor } });
  }
  return tx.locacaoPreco.create({
    data: {
      locacaoId: id,
      valorDiariaAplicada: quote.valorDiariaAplicada,
      qtdDiarias: quote.qtdDiarias,
      subtotalDiarias: quote.subtotalDiarias,
      totalAdicionais: quote.totalAdicionais,
      totalProtecoes: quote.totalProtecoes,
      descontoTotal: quote.descontoTotal,
      impostosTaxas: quote.impostosTaxas,
      valorTotal: quote.valorTotal,
      valorCaucao: quote.valorCaucao,
      regrasAplicadas: quote.regrasAplicadas,
      promocaoId: quote.promocaoId,
    },
  });
}

module.exports = {
  obterAdmin,
  salvarConfiguracao,
  salvarCustos,
  salvarTarifa,
  salvarRegra,
  salvarAdicional,
  salvarProtecao,
  salvarPromocao,
  salvarNivel,
  salvarPiso,
  listarHistorico,
  cotar,
  obterOpcoes,
  prepararCotacao,
  salvarSnapshot,
};
