const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");
const Decimal = require("decimal.js");

const STATUSES = [
  "disponivel",
  "alugado",
  "reservado",
  "manutencao",
  "inativo",
];
const ENUMS = {
  cambio: ["manual", "automatico"],
  combustivel: ["gasolina", "etanol", "flex", "diesel", "eletrico", "hibrido"],
  formaAquisicao: ["a_vista", "financiado", "leasing"],
};
const PUBLIC_FIELDS = [
  "id",
  "marca",
  "modelo",
  "versao",
  "anoFabricacao",
  "anoModelo",
  "cor",
  "categoria",
  "cambio",
  "combustivel",
  "numPortas",
  "numPassageiros",
  "capacidadePortaMalas",
  "opcionais",
  "status",
  "filial",
];
const WRITABLE = new Set([
  "placa",
  "marca",
  "modelo",
  "versao",
  "ano",
  "anoFabricacao",
  "anoModelo",
  "cor",
  "categoriaId",
  "cambio",
  "combustivel",
  "motor",
  "numPortas",
  "numPassageiros",
  "capacidadePortaMalas",
  "dataCompra",
  "valorCompra",
  "formaAquisicao",
  "valorFipe",
  "valorRevendaEstimado",
  "vidaUtilMeses",
  "crlvVencimento",
  "ipvaVencimento",
  "licenciamentoVencimento",
  "seguradora",
  "apoliceNumero",
  "apoliceVencimento",
  "apoliceFranquia",
  "status",
  "kmAtual",
  "nivelCombustivel",
  "filialId",
  "proximaRevisaoKm",
  "proximaRevisaoData",
  "disponivel",
  "renavam",
  "chassi",
  "opcionais",
]);
const HISTORY = {
  manutencoes: {
    model: "manutencao",
    required: ["data", "tipo"],
    strings: { tipo: 50, descricao: 5000 },
    numbers: { valor: 99999999.99, km: 4294967295 },
  },
  sinistros: {
    model: "sinistroAvaria",
    required: ["data", "descricao"],
    strings: { descricao: 5000 },
    numbers: { valorReparo: 99999999.99 },
    enums: { status: ["aberto", "em_andamento", "resolvido"] },
  },
  multas: {
    model: "multa",
    required: ["data", "infracao", "valor"],
    strings: { infracao: 120 },
    numbers: { valor: 99999999.99 },
    enums: { status: ["pendente", "paga", "contestada"] },
    locacao: true,
  },
  vistorias: {
    model: "vistoria",
    required: ["data", "tipo", "km", "nivelCombustivel"],
    strings: { observacoes: 5000 },
    numbers: { km: 4294967295, nivelCombustivel: 100 },
    enums: { tipo: ["saida", "entrada"] },
    locacao: true,
  },
};
function fail(message) {
  throw new AppError(message, 400);
}
function validId(value, label = "Id") {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) fail(`${label} inválido`);
  return n;
}
function parseDate(value, field) {
  const d = new Date(value);
  if (typeof value !== "string" || !value.trim() || Number.isNaN(d.getTime()))
    fail(`${field} inválida`);
  return d;
}
function parseNumber(
  value,
  field,
  { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {},
) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  )
    fail(`${field} inválido`);
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    fail(`${field} inválido`);
  return n;
}
function publicDto(vehicle) {
  const out = {};
  for (const key of PUBLIC_FIELDS)
    if (Object.prototype.hasOwnProperty.call(vehicle, key))
      out[key] = vehicle[key];
  return out;
}
function semTarifaLegada(vehicle) {
  if (!vehicle) return vehicle;
  const { valorDiaria, ...dados } = vehicle;
  return dados;
}
function onlyKnown(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`Campos não permitidos: ${unknown.join(", ")}`);
}
async function cleanVehicle(body, editing) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Corpo inválido");
  if (Object.hasOwn(body, "valorDiaria"))
    fail("valorDiaria é gerido exclusivamente pela precificação");
  onlyKnown(body, WRITABLE);
  const data = { ...body };
  delete data.disponivel;
  if (data.placa !== undefined) {
    data.placa = String(data.placa).trim().toUpperCase();
    if (!/^[A-Z0-9-]{5,8}$/.test(data.placa)) fail("placa inválida");
  }
  for (const [key, max] of Object.entries({
    marca: 50,
    modelo: 80,
    versao: 80,
    cor: 30,
    renavam: 11,
    chassi: 17,
    motor: 20,
    seguradora: 80,
    apoliceNumero: 40,
  })) {
    if (data[key] !== undefined) {
      if (
        typeof data[key] !== "string" ||
        data[key].trim().length > max ||
        (["marca", "modelo"].includes(key) && !data[key].trim())
      )
        fail(`${key} inválido`);
      data[key] = data[key].trim();
    }
  }
  if (data.renavam !== undefined && !/^\d{11}$/.test(data.renavam))
    fail("renavam deve conter 11 dígitos");
  if (data.chassi !== undefined) {
    data.chassi = data.chassi.toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(data.chassi))
      fail("chassi deve conter 17 caracteres válidos");
  }
  for (const [key, values] of Object.entries(ENUMS))
    if (data[key] !== undefined && !values.includes(data[key]))
      fail(`${key} inválido`);
  if (data.status !== undefined && !STATUSES.includes(data.status))
    fail("status inválido");
  if (data.ano !== undefined) {
    const y = parseNumber(data.ano, "ano", {
      min: 1886,
      max: 2100,
      integer: true,
    });
    if (data.anoFabricacao === undefined) data.anoFabricacao = y;
    if (data.anoModelo === undefined) data.anoModelo = y;
    delete data.ano;
  }
  for (const key of ["anoFabricacao", "anoModelo"])
    if (data[key] !== undefined)
      data[key] = parseNumber(data[key], key, {
        min: 1886,
        max: 2100,
        integer: true,
      });
  if (
    data.anoFabricacao !== undefined &&
    data.anoModelo !== undefined &&
    data.anoModelo < data.anoFabricacao
  )
    fail("anoModelo não pode ser anterior a anoFabricacao");
  for (const [key, max] of Object.entries({
    categoriaId: 2147483647,
    filialId: 2147483647,
    kmAtual: 4294967295,
    nivelCombustivel: 100,
    numPortas: 8,
    numPassageiros: 255,
    capacidadePortaMalas: 65535,
    vidaUtilMeses: 65535,
    proximaRevisaoKm: 4294967295,
  }))
    if (data[key] !== undefined)
      data[key] = parseNumber(data[key], key, { max, integer: true });
  for (const key of ["valorCompra", "valorFipe", "valorRevendaEstimado"])
    if (data[key] !== undefined)
      data[key] = parseNumber(data[key], key, { max: 9999999999.99 });
  for (const key of ["apoliceFranquia"])
    if (data[key] !== undefined)
      data[key] = parseNumber(data[key], key, { max: 99999999.99 });
  for (const key of [
    "dataCompra",
    "crlvVencimento",
    "ipvaVencimento",
    "licenciamentoVencimento",
    "apoliceVencimento",
    "proximaRevisaoData",
  ])
    if (data[key] !== undefined && data[key] !== null)
      data[key] = parseDate(data[key], key);
  if (data.opcionais !== undefined) {
    if (!Array.isArray(data.opcionais)) fail("opcionais inválidos");
    const ids = [
      ...new Set(data.opcionais.map((x) => validId(x, "opcionalId"))),
    ];
    const criacoes = ids.map((opcionalId) => ({
      opcional: { connect: { id: opcionalId } },
    }));
    data.opcionais = editing
      ? { deleteMany: {}, create: criacoes }
      : { create: criacoes };
  }
  if (!editing) {
    if (!data.placa || !data.marca || !data.modelo)
      fail("placa, marca e modelo são obrigatórios");
    if (data.anoFabricacao === undefined && data.anoModelo !== undefined)
      data.anoFabricacao = data.anoModelo;
    if (data.anoModelo === undefined && data.anoFabricacao !== undefined)
      data.anoModelo = data.anoFabricacao;
    data.status = data.status || "inativo";
    for (const key of ["categoriaId", "filialId"])
      if (data[key] !== undefined) data[key] = validId(data[key], key);
    if (!data.categoriaId)
      data.categoriaId = (
        await prisma.categoriaVeiculo.findUnique({
          where: { nome: "Econômico" },
          select: { id: true },
        })
      )?.id;
    if (!data.filialId)
      data.filialId = (
        await prisma.filial.findUnique({
          where: { nome: "Matriz" },
          select: { id: true },
        })
      )?.id;
    if (!data.categoriaId || !data.filialId)
      throw new AppError(
        "Cadastre categorias e filiais antes de veículos",
        409,
      );
  }
  return data;
}
const vehicleInclude = {
  opcionais: { include: { opcional: true } },
  categoria: true,
  filial: true,
};
async function cadastrar(body) {
  const veiculo = await prisma.veiculo.create({
    data: await cleanVehicle(body, false),
    include: vehicleInclude,
  });
  return semTarifaLegada(veiculo);
}
async function editar(id, body) {
  const veiculoId = validId(id);
  const data = await cleanVehicle(body, true);
  if (data.status === "disponivel") {
    const existente = await prisma.veiculo.findUnique({
      where: { id: veiculoId },
      select: { id: true },
    });
    if (!existente) throw new AppError("Veículo não encontrado", 404);
    const locacaoAtiva = await prisma.locacao.findFirst({
      where: {
        veiculoId,
        status: { in: ["reservada", "retirada", "em_andamento"] },
      },
      select: { id: true },
    });
    if (locacaoAtiva)
      throw new AppError(
        "Veículo possui locação ativa e não pode ficar disponível",
        409,
      );
    const opcionais = data.opcionais;
    delete data.opcionais;
    const veiculo = await prisma.$transaction(async (tx) => {
      const atualizacao = await tx.veiculo.updateMany({
        where: {
          id: veiculoId,
          status: { notIn: ["alugado", "reservado"] },
        },
        data,
      });
      if (atualizacao.count === 0)
        throw new AppError(
          "O status do veículo mudou; atualize a tela e tente novamente",
          409,
        );
      if (opcionais !== undefined)
        await tx.veiculo.update({
          where: { id: veiculoId },
          data: { opcionais },
        });
      return tx.veiculo.findUnique({
        where: { id: veiculoId },
        include: vehicleInclude,
      });
    });
    return semTarifaLegada(veiculo);
  }
  const veiculo = await prisma.veiculo.update({
    where: { id: veiculoId },
    data,
    include: vehicleInclude,
  });
  return semTarifaLegada(veiculo);
}
async function listar({ disponivel, status, userRole }) {
  const where = {};
  if (userRole !== "ADMIN") {
    where.status = { in: ["disponivel", "alugado", "reservado"] };
  } else if (status !== undefined) {
    if (!STATUSES.includes(status)) fail("status inválido");
    where.status = status;
  }
  if (userRole === "ADMIN" && disponivel !== undefined) {
    if (!["true", "false"].includes(disponivel))
      fail("Filtro disponivel deve ser true ou false");
    where.status = disponivel === "true" ? "disponivel" : { not: "disponivel" };
  }
  return (
    await prisma.veiculo.findMany({
      where,
      include: vehicleInclude,
      orderBy: { id: "asc" },
    })
  ).map(publicDto);
}
async function listarCatalogo() {
  return prisma.veiculo.findMany({
    where: { status: "disponivel" },
    select: {
      id: true,
      marca: true,
      modelo: true,
      versao: true,
      anoFabricacao: true,
      anoModelo: true,
      cor: true,
      cambio: true,
      combustivel: true,
      numPortas: true,
      numPassageiros: true,
      capacidadePortaMalas: true,
      categoria: { select: { id: true, nome: true } },
    },
    orderBy: [{ marca: "asc" }, { modelo: "asc" }],
  });
}
async function metadados() {
  const [categorias, filiais, opcionais] = await Promise.all([
    prisma.categoriaVeiculo.findMany({ orderBy: { nome: "asc" } }),
    prisma.filial.findMany({ orderBy: { nome: "asc" } }),
    prisma.opcionalVeiculo.findMany({ orderBy: { nome: "asc" } }),
  ]);
  return { categorias, filiais, opcionais };
}
async function detalhe(id) {
  const v = await prisma.veiculo.findUnique({
    where: { id: validId(id) },
    include: vehicleInclude,
  });
  if (!v) throw new AppError("Veículo não encontrado", 404);
  return semTarifaLegada(v);
}
async function historico(id) {
  const v = await detalhe(id);
  const [manutencoes, sinistros, multas, vistorias] = await Promise.all([
    prisma.manutencao.findMany({
      where: { veiculoId: v.id },
      orderBy: { data: "desc" },
    }),
    prisma.sinistroAvaria.findMany({
      where: { veiculoId: v.id },
      orderBy: { data: "desc" },
    }),
    prisma.multa.findMany({
      where: { veiculoId: v.id },
      orderBy: { data: "desc" },
    }),
    prisma.vistoria.findMany({
      where: { veiculoId: v.id },
      orderBy: { data: "desc" },
    }),
  ]);
  return { manutencoes, sinistros, multas, vistorias };
}
async function locacoesVinculadas(id) {
  const veiculoId = validId(id, "veiculoId");
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: veiculoId },
    select: { id: true },
  });
  if (!veiculo) throw new AppError("Veículo não encontrado", 404);
  return prisma.locacao.findMany({
    where: { veiculoId },
    select: {
      id: true,
      dataInicio: true,
      dataPrevistaDevolucao: true,
      status: true,
    },
    orderBy: { dataInicio: "desc" },
  });
}
function cobreData(locacao, data) {
  if (locacao.status === "cancelada") return false;
  const inicio = locacao.retiradaReal || locacao.dataInicio;
  const fim = locacao.dataDevolucaoEfetiva || locacao.dataPrevistaDevolucao;
  return inicio <= data && data <= fim;
}
async function registrarMulta(veiculoId, dados) {
  const multaData = { ...dados };
  const locacaoIdInformada = multaData.locacaoId;
  delete multaData.locacaoId;
  multaData.veiculo = { connect: { id: veiculoId } };

  return prisma.$transaction(async (tx) => {
    let locacao = null;
    if (locacaoIdInformada !== undefined && locacaoIdInformada !== null) {
      const locacaoId = validId(locacaoIdInformada, "locacaoId");
      locacao = await tx.locacao.findUnique({
        where: { id: locacaoId },
        select: {
          id: true,
          veiculoId: true,
          status: true,
          dataInicio: true,
          dataPrevistaDevolucao: true,
          retiradaReal: true,
          dataDevolucaoEfetiva: true,
        },
      });
      if (!locacao) throw new AppError("Locação não encontrada", 404);
      if (locacao.veiculoId !== veiculoId) fail("locacaoId não pertence ao veículo");
      if (!cobreData(locacao, multaData.data))
        fail("data da infração fora do período da locação");
    } else {
      const candidatas = await tx.locacao.findMany({
        where: {
          veiculoId,
          status: { not: "cancelada" },
          OR: [
            { dataInicio: { lte: multaData.data } },
            { retiradaReal: { lte: multaData.data } },
          ],
        },
        select: {
          id: true,
          veiculoId: true,
          status: true,
          dataInicio: true,
          dataPrevistaDevolucao: true,
          retiradaReal: true,
          dataDevolucaoEfetiva: true,
        },
      });
      const correspondentes = candidatas.filter((item) => cobreData(item, multaData.data));
      if (correspondentes.length > 1)
        throw new AppError(
          "Mais de uma locação corresponde à data; selecione a locação correta",
          409,
        );
      locacao = correspondentes[0] || null;
    }

    if (locacao) multaData.locacao = { connect: { id: locacao.id } };
    const multa = await tx.multa.create({ data: multaData });
    if (!locacao) return multa;

    const configuracao = await tx.configuracaoPrecificacao.findUnique({
      where: { id: 1 },
      select: { taxaAdminMultaTransito: true },
    });
    const valorInfracao = new Decimal(dados.valor);
    const taxaAdministrativa = new Decimal(
      configuracao?.taxaAdminMultaTransito ?? 0,
    );
    const total = valorInfracao.plus(taxaAdministrativa).toDecimalPlaces(2);
    if (!total.gt(0) || total.gt("99999999.99"))
      fail("Valor total da multa e taxa administrativa excede o limite permitido");
    const descricao =
      `Multa #${multa.id}: ${String(dados.infracao).slice(0, 42)} · ` +
      `R$ ${valorInfracao.toFixed(2)} + taxa R$ ${taxaAdministrativa.toFixed(2)}`;
    await tx.locacaoCobrancaExtra.create({
      data: {
        locacaoId: locacao.id,
        multaId: multa.id,
        tipo: "multa_transito",
        descricao,
        valor: total,
      },
    });
    await tx.locacaoPagamento.create({
      data: {
        locacaoId: locacao.id,
        tipo: "saldo",
        valor: total,
        status: "pendente",
      },
    });
    if (locacao.status === "finalizada") {
      const atual = await tx.locacao.findUnique({
        where: { id: locacao.id },
        select: { valorFinalCobrado: true, valorTotal: true },
      });
      let valorFinal = new Decimal(atual.valorFinalCobrado ?? 0).plus(total);
      if (atual.valorFinalCobrado === null) {
        const extras = await tx.locacaoCobrancaExtra.aggregate({
          where: { locacaoId: locacao.id },
          _sum: { valor: true },
        });
        valorFinal = new Decimal(atual.valorTotal).plus(extras._sum.valor ?? 0);
      }
      await tx.locacao.update({
        where: { id: locacao.id },
        data: { valorFinalCobrado: valorFinal },
      });
    }
    return multa;
  }, { isolationLevel: "Serializable" });
}
async function adicionar(id, kind, body) {
  const veiculoId = validId(id, "veiculoId"),
    rule = HISTORY[kind];
  if (!rule) fail("Rota inválida");
  await detalhe(veiculoId);
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Corpo inválido");
  const allowed = new Set([
    "data",
    ...Object.keys(rule.strings || {}),
    ...Object.keys(rule.numbers || {}),
    ...Object.keys(rule.enums || {}),
    ...(rule.locacao ? ["locacaoId"] : []),
  ]);
  onlyKnown(body, allowed);
  const d = { ...body };
  for (const key of rule.required)
    if (d[key] === undefined || d[key] === null || d[key] === "")
      fail(`${key} obrigatório`);
  d.data = parseDate(d.data, "data");
  for (const [key, max] of Object.entries(rule.strings || {}))
    if (d[key] !== undefined) {
      if (typeof d[key] !== "string" || !d[key].trim() || d[key].length > max)
        fail(`${key} inválido`);
      d[key] = d[key].trim();
    }
  for (const [key, values] of Object.entries(rule.enums || {}))
    if (d[key] !== undefined && !values.includes(d[key]))
      fail(`${key} inválido`);
  for (const [key, max] of Object.entries(rule.numbers || {}))
    if (d[key] !== undefined)
      d[key] = parseNumber(d[key], key, {
        max,
        integer: ["km", "nivelCombustivel"].includes(key),
      });
  if (kind === "multas") return registrarMulta(veiculoId, d);
  let locacaoId;
  if (rule.locacao && d.locacaoId !== undefined && d.locacaoId !== null) {
    locacaoId = validId(d.locacaoId, "locacaoId");
    const loc = await prisma.locacao.findUnique({
      where: { id: locacaoId },
      select: { veiculoId: true },
    });
    if (!loc) throw new AppError("Locação não encontrada", 404);
    if (loc.veiculoId !== veiculoId) fail("locacaoId não pertence ao veículo");
  }
  delete d.locacaoId;
  d.veiculo = { connect: { id: veiculoId } };
  if (locacaoId !== undefined) d.locacao = { connect: { id: locacaoId } };
  return prisma[rule.model].create({ data: d });
}
module.exports = {
  cadastrar,
  editar,
  listar,
  listarCatalogo,
  metadados,
  detalhe,
  historico,
  locacoesVinculadas,
  adicionar,
  publicDto,
  dto: publicDto,
  cleanVehicle,
};
