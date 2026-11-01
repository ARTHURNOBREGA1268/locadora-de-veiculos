const { randomBytes } = require("node:crypto");
const Decimal = require("decimal.js");
const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");
const { converterData } = require("../lib/isoDateTime");
const clienteService = require("./cliente.service");
const calculo = require("./precificacao.calculo");
const precificacao = require("./precificacao.service");

const DIA = 86400000;
const ESTADOS_ATIVOS = ["reservada", "retirada", "em_andamento"];
const ORIGENS = ["balcao", "site", "telefone", "app", "convenio"];
const FORMAS_PAGAMENTO = ["credito", "debito", "pix", "boleto", "dinheiro", "faturado"];
const TRANSICOES = {
  retirar: ["reservada", "retirada"],
  iniciar: ["retirada", "em_andamento"],
  devolver: ["em_andamento", "devolvida"],
  finalizar: ["devolvida", "finalizada"],
  cancelar: ["reservada", "cancelada"],
};

function falha(mensagem, status = 400) {
  throw new AppError(mensagem, status);
}

function calcularValorTotal(diaria, inicio, fim) {
  return Math.round(Number(diaria) * Math.ceil((fim - inicio) / DIA) * 100) / 100;
}

function idValido(valor, campo) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) falha(`${campo} inválido`);
  return numero;
}

function numeroInteiro(valor, campo, max = 4294967295) {
  if (valor === "" || valor === null || valor === undefined) falha(`${campo} obrigatório`);
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0 || numero > max) falha(`${campo} inválido`);
  return numero;
}

function percentualCombustivel(valor, campo) {
  const numero = numeroInteiro(valor, campo, 100);
  return numero;
}

function centavos(valor) {
  return new Decimal(valor || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function formaParaCotacao(forma) {
  if (forma === "credito" || forma === "debito" || forma === "cartao") return "cartao";
  return forma;
}

async function obterConfiguracao(tx = prisma) {
  return tx.configuracaoLocacao.upsert({
    where: { id: 1 },
    create: { id: 1, documentosExigidos: ["CNH válida", "Documento de identidade"] },
    update: {},
  });
}

async function obterConfiguracaoPreco(tx) {
  return tx.configuracaoPrecificacao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

async function validarCliente(tx, usuarioId, papel, clienteIdEntrada) {
  if (papel === "ADMIN") {
    if (clienteIdEntrada === undefined || clienteIdEntrada === null || clienteIdEntrada === "") falha("ADMIN deve selecionar o cliente da locação");
    const clienteId = idValido(clienteIdEntrada, "clienteId");
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, cpf: true, email: true, telefone: true, ativo: true } });
    if (!cliente || !cliente.ativo) falha("Cliente não encontrado ou inativo", 404);
    return cliente;
  }
  if (papel !== "ADMIN" && clienteIdEntrada !== undefined) falha("USER não pode selecionar outro cliente", 403);
  const cliente = await tx.cliente.findUnique({ where: { usuarioId }, select: { id: true, nome: true, cpf: true, email: true, telefone: true, ativo: true } });
  if (!cliente || !cliente.ativo) falha("Perfil de cliente não encontrado ou inativo", 404);
  return cliente;
}

async function verificarDisponibilidade(tx, veiculoId, inicio, fim) {
  const veiculo = await tx.veiculo.findUnique({
    where: { id: veiculoId },
    select: { id: true, status: true, categoriaId: true, filialId: true, placa: true, marca: true, modelo: true, categoria: { select: { id: true, nome: true } } },
  });
  if (!veiculo) falha("Veículo não encontrado", 404);
  if (["inativo", "manutencao"].includes(veiculo.status)) falha("Veículo indisponível para o período selecionado", 409);
  const conflito = await tx.locacao.findFirst({
    where: {
      veiculoId,
      status: { in: ESTADOS_ATIVOS },
      dataInicio: { lt: fim },
      dataPrevistaDevolucao: { gt: inicio },
    },
    select: { id: true },
  });
  if (conflito) falha("Veículo já possui locação ativa no período solicitado", 409);
  return veiculo;
}

async function reservarVeiculo(tx, veiculoId, inicio, fim) {
  const veiculo = await tx.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true, status: true } });
  if (!veiculo || ["inativo", "manutencao"].includes(veiculo.status)) falha("Veículo indisponível", 409);
  if (inicio && fim) {
    const conflito = await tx.locacao.findFirst({
      where: { veiculoId, status: { in: ESTADOS_ATIVOS }, dataInicio: { lt: fim }, dataPrevistaDevolucao: { gt: inicio } },
      select: { id: true },
    });
    if (conflito) falha("Veículo possui locação ativa no período", 409);
  } else {
    const conflito = await tx.locacao.findFirst({ where: { veiculoId, status: { in: ESTADOS_ATIVOS } }, select: { id: true } });
    if (conflito) falha("Veículo possui locação ativa", 409);
  }
  if (veiculo.status === "disponivel") {
    const atualizado = await tx.veiculo.updateMany({ where: { id: veiculoId, status: "disponivel" }, data: { status: "reservado" } });
    if (!atualizado.count) falha("Veículo indisponível", 409);
  }
  return veiculo;
}

async function validarFiliais(tx, config, veiculo, body) {
  const retiradaId = body.filialRetiradaId === undefined ? veiculo.filialId : idValido(body.filialRetiradaId, "filialRetiradaId");
  const devolucaoId = body.filialDevolucaoId === undefined ? retiradaId : idValido(body.filialDevolucaoId, "filialDevolucaoId");
  const [retirada, devolucao, filiaisRetirada, filiaisDevolucao] = await Promise.all([
    tx.filial.findUnique({ where: { id: retiradaId }, select: { id: true } }),
    tx.filial.findUnique({ where: { id: devolucaoId }, select: { id: true } }),
    tx.configFilial.findMany({ where: { configId: 1, tipo: "retirada" }, select: { filialId: true } }),
    tx.configFilial.findMany({ where: { configId: 1, tipo: "devolucao" }, select: { filialId: true } }),
  ]);
  if (!retirada || !devolucao) falha("Filial de retirada ou devolução não encontrada", 404);
  if (filiaisRetirada.length && !filiaisRetirada.some((item) => item.filialId === retiradaId)) falha("Filial não habilitada para retirada", 400);
  if (retiradaId !== veiculo.filialId && filiaisRetirada.length === 0) falha("Retirada deve ocorrer na filial do veículo enquanto não houver filiais configuradas", 400);
  if (devolucaoId !== retiradaId && !config.permiteDevolucaoOutraFilial) falha("Devolução em outra filial não permitida", 400);
  if (filiaisDevolucao.length && !filiaisDevolucao.some((item) => item.filialId === devolucaoId)) falha("Filial não habilitada para devolução", 400);
  return { retiradaId, devolucaoId };
}

async function validarMotoristas(tx, entradas, clientePrincipal, userRole, config) {
  if (!Array.isArray(entradas)) falha("Motoristas inválidos");
  if (entradas.length > config.maxMotoristasAdicionais || (entradas.length && !config.permiteMotoristaAdicional)) {
    falha("Quantidade de motoristas adicionais não permitida", 400);
  }
  const ids = [];
  for (const entrada of entradas) {
    if (typeof entrada === "number" || (typeof entrada === "string" && Number.isSafeInteger(Number(entrada)) && Number(entrada) > 0)) {
      if (userRole !== "ADMIN") falha("USER deve informar os dados do motorista adicional", 403);
      ids.push(idValido(entrada, "motoristaId"));
      continue;
    }
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) falha("Dados do motorista adicional inválidos");
    const desconhecidos = Object.keys(entrada).filter((campo) => !["nome", "cpf", "email", "telefone"].includes(campo));
    if (desconhecidos.length) falha(`Campos não permitidos no motorista: ${desconhecidos.join(", ")}`);
    const nome = clienteService.validarNome(entrada.nome);
    const cpf = clienteService.normalizarCpf(entrada.cpf);
    if (!cpf) falha("CPF obrigatório para motorista adicional");
    const email = clienteService.normalizarEmail(entrada.email);
    const telefone = clienteService.normalizarTelefone(entrada.telefone);
    let motorista = await tx.cliente.findUnique({ where: { cpf }, select: { id: true, ativo: true } });
    if (motorista && !motorista.ativo) falha("Motorista adicional inativo", 409);
    if (!motorista) motorista = await tx.cliente.create({ data: { nome, cpf, email, telefone }, select: { id: true, ativo: true } });
    ids.push(motorista.id);
  }
  if (new Set(ids).size !== ids.length || ids.includes(clientePrincipal.id)) falha("Motorista duplicado ou igual ao cliente principal", 400);
  if (ids.length) {
    const encontrados = await tx.cliente.count({ where: { id: { in: ids }, ativo: true } });
    if (encontrados !== ids.length) falha("Motorista adicional não encontrado ou inativo", 404);
  }
  return ids;
}

function montarContrato(modelo, dados) {
  if (typeof modelo !== "string" || !modelo.trim()) return null;
  const valores = {
    codigo: dados.codigo,
    cliente: dados.cliente.nome,
    cpf: dados.cliente.cpf || "",
    veiculo: `${dados.veiculo.marca} ${dados.veiculo.modelo}`,
    placa: dados.veiculo.placa,
    retirada: dados.inicio.toISOString(),
    devolucao: dados.fim.toISOString(),
    valor_total: String(dados.valorTotal),
  };
  return modelo.replace(/\{\{([a-z_]+)\}\}/g, (match, chave) => Object.hasOwn(valores, chave) ? String(valores[chave]) : match);
}

const includeCompleto = {
  cliente: { select: { id: true, nome: true, cpf: true, email: true, telefone: true, ativo: true, usuarioId: true } },
  veiculo: { include: { categoria: true, filial: true } },
  categoria: true,
  atendente: { select: { id: true, nome: true } },
  filialRetirada: true,
  filialDevolucao: true,
  preco: true,
  pagamentos: { orderBy: { id: "asc" } },
  motoristas: { include: { cliente: { select: { id: true, nome: true, cpf: true, email: true, telefone: true } } }, orderBy: { id: "asc" } },
  adicionais: { include: { adicional: true }, orderBy: { id: "asc" } },
  protecoes: { include: { protecao: true }, orderBy: { id: "asc" } },
  cobrancasExtras: { orderBy: { id: "asc" } },
  vistoriaSaida: true,
  vistoriaEntrada: true,
  historicoStatus: { include: { usuario: { select: { id: true, nome: true } } }, orderBy: { alteradoEm: "asc" } },
};

async function criar({ usuarioId, userRole = "USER", clienteId, veiculoId, dataInicio, dataPrevistaDevolucao, adicionais, protecoes, cupom, convenioId, taxas = {}, formaPagamento = "pix", parcelas = 1, filialRetiradaId, filialDevolucaoId, entregaDomicilio = false, enderecoEntrega, enderecoColeta, distanciaEntregaKm, vooNumero, origem, observacoes, motoristas = [] }) {
  const vid = idValido(veiculoId, "veiculoId");
  const inicio = converterData(dataInicio, "Data de início");
  const fim = converterData(dataPrevistaDevolucao, "Data prevista de devolução");
  if (fim <= inicio) falha("Data prevista de devolução deve ser posterior à data de início");
  if (!FORMAS_PAGAMENTO.includes(formaPagamento) && formaPagamento !== "cartao") falha("Forma de pagamento inválida");
  if (!Array.isArray(motoristas)) falha("Motoristas inválidos");
  const c = await obterConfiguracao();
  const agora = Date.now();
  const horas = (inicio.getTime() - agora) / 3600000;
  const dias = Math.ceil((fim - inicio) / DIA);
  if (horas < c.antecedenciaMinimaHoras) falha("Antecedência mínima não atendida");
  if (horas > c.antecedenciaMaximaDias * 24) falha("Antecedência máxima excedida");
  if (dias < c.periodoMinimoDiarias || dias > c.periodoMaximoDiarias) falha("Duração da locação fora dos limites permitidos");
  if (entregaDomicilio && !c.permiteEntregaDomicilio) falha("Entrega domiciliar não permitida");
  const entregaKm = distanciaEntregaKm === undefined || distanciaEntregaKm === null || distanciaEntregaKm === "" ? null : Number(distanciaEntregaKm);
  if (entregaKm !== null && (!Number.isFinite(entregaKm) || entregaKm < 0 || entregaKm > 9999.99)) falha("distanciaEntregaKm inválida");
  if (entregaDomicilio && (!enderecoEntrega || typeof enderecoEntrega !== "string" || !enderecoEntrega.trim())) falha("Endereço de entrega obrigatório");
  if (entregaDomicilio && c.raioEntregaKm !== null && entregaKm !== null && entregaKm > c.raioEntregaKm) falha("Distância excede o raio de entrega permitido");
  if (enderecoEntrega !== undefined && (typeof enderecoEntrega !== "string" || enderecoEntrega.length > 255)) falha("enderecoEntrega inválido");
  if (enderecoColeta !== undefined && (typeof enderecoColeta !== "string" || enderecoColeta.length > 255)) falha("enderecoColeta inválido");
  if (vooNumero !== undefined && (typeof vooNumero !== "string" || vooNumero.length > 10)) falha("vooNumero inválido");
  const formaPersistida = formaPagamento === "cartao" ? "credito" : formaPagamento;
  if (c.exigeCartaoCredito && formaPersistida !== "credito") falha("É necessário informar cartão de crédito para esta locação");
  const formaCalculo = formaParaCotacao(formaPersistida);
  const quantidadeParcelas = formaPersistida === "credito" ? Number(parcelas || 1) : 1;
  if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas < 1 || quantidadeParcelas > 255) falha("parcelas inválidas");
  if (origem !== undefined && (userRole !== "ADMIN" || !ORIGENS.includes(origem))) falha("origem inválida ou não autorizada");
  if (observacoes !== undefined && (typeof observacoes !== "string" || observacoes.length > 5000)) falha("observacoes inválidas");

  return prisma.$transaction(async (tx) => {
    const cliente = await validarCliente(tx, usuarioId, userRole, clienteId);
    const veiculo = await verificarDisponibilidade(tx, vid, inicio, fim);
    const filialIds = await validarFiliais(tx, c, veiculo, { filialRetiradaId, filialDevolucaoId });
    const precosTaxas = { ...taxas };
    if (entregaDomicilio) {
      precosTaxas.entregaDomicilio = true;
      precosTaxas.distanciaEntregaKm = entregaKm || 0;
    }
    if (filialIds.devolucaoId !== filialIds.retiradaId) precosTaxas.outraFilial = true;
    const cotacaoBody = {
      veiculoId: vid,
      dataInicio: inicio,
      dataPrevistaDevolucao: fim,
      adicionais,
      protecoes,
      cupom,
      convenioId,
      taxas: precosTaxas,
      formaPagamento: formaCalculo,
      parcelas: quantidadeParcelas,
    };
    if (userRole === "ADMIN") cotacaoBody.clienteId = cliente.id;
    const cotacao = await precificacao.prepararCotacao(tx, usuarioId, userRole, cotacaoBody);
    if (cotacao.clienteId !== cliente.id) falha("Cliente da cotação não corresponde à locação", 409);
    const idsMotoristas = await validarMotoristas(tx, motoristas, cliente, userRole, c);
    await reservarVeiculo(tx, vid, inicio, fim);
    const placeholder = `TMP${randomBytes(7).toString("hex")}`;
    const locacaoBase = await tx.locacao.create({
      data: {
        codigo: placeholder,
        clienteId: cliente.id,
        veiculoId: vid,
        categoriaId: veiculo.categoriaId,
        status: "reservada",
        origem: userRole === "ADMIN" ? (origem || "balcao") : "site",
        atendenteId: userRole === "ADMIN" ? usuarioId : null,
        dataInicio: inicio,
        dataPrevistaDevolucao: fim,
        qtdDiariasPrevistas: cotacao.qtdDiarias,
        filialRetiradaId: filialIds.retiradaId,
        filialDevolucaoId: filialIds.devolucaoId,
        entregaDomicilio: Boolean(entregaDomicilio),
        enderecoEntrega: enderecoEntrega?.trim() || null,
        enderecoColeta: enderecoColeta?.trim() || null,
        distanciaEntregaKm: entregaKm,
        vooNumero: vooNumero?.trim() || null,
        kmFranquiaTotal: c.kmLivre || c.kmFranquiaDiaria === null ? null : Number(c.kmFranquiaDiaria) * cotacao.qtdDiarias,
        valorTotal: cotacao.valorTotal,
        caucaoValor: cotacao.valorCaucao,
        caucaoStatus: "pendente",
        formaPagamento: formaPersistida,
        parcelas: quantidadeParcelas,
        promocaoId: cotacao.promocaoId,
        observacoes: observacoes?.trim() || null,
        contratoTexto: montarContrato(c.modeloContrato, { codigo: placeholder, cliente, veiculo, inicio, fim, valorTotal: cotacao.valorTotal }),
      },
    });
    const codigo = `LOC-${inicio.getUTCFullYear()}-${String(locacaoBase.id).padStart(6, "0")}`;
    const locacaoId = locacaoBase.id;
    const contratoTexto = montarContrato(c.modeloContrato, { codigo, cliente, veiculo, inicio, fim, valorTotal: cotacao.valorTotal });
    await tx.locacao.update({ where: { id: locacaoId }, data: { codigo, contratoTexto } });
    await precificacao.salvarSnapshot(tx, locacaoId, cotacao);
    await tx.locacaoMotorista.create({ data: { locacaoId, clienteId: cliente.id, principal: true } });
    if (idsMotoristas.length) {
      await tx.locacaoMotorista.createMany({ data: idsMotoristas.map((id) => ({ locacaoId, clienteId: id, principal: false })) });
    }
    for (const item of cotacao.detalhes.adicionais || []) {
      await tx.locacaoAdicional.create({
        data: {
          locacaoId,
          adicionalId: item.id,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.total,
        },
      });
    }
    for (const item of cotacao.detalhes.protecoes || []) {
      await tx.locacaoProtecao.create({
        data: { locacaoId, protecaoId: item.protecaoId, valorDiaria: item.diaria, valorTotal: item.total },
      });
    }
    await tx.locacaoPagamento.create({ data: { locacaoId, tipo: "reserva", valor: cotacao.valorTotal, status: "pendente" } });
    if (cotacao.valorCaucao && centavos(cotacao.valorCaucao).gt(0)) {
      await tx.locacaoPagamento.create({ data: { locacaoId, tipo: "caucao", valor: cotacao.valorCaucao, status: "pendente" } });
    }
    await tx.locacaoStatusHistorico.create({ data: { locacaoId, statusAnterior: "", statusNovo: "reservada", usuarioId } });
    return tx.locacao.findUnique({ where: { id: locacaoId }, include: includeCompleto });
  }, { isolationLevel: "Serializable" });
}

async function listar(usuarioId, userRole = "USER") {
  return prisma.locacao.findMany({
    where: userRole === "ADMIN" ? {} : { cliente: { is: { usuarioId } } },
    include: includeCompleto,
    orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
    take: 500,
  });
}

async function buscar(usuarioId, userRole, idEntrada) {
  const id = idValido(idEntrada, "locacaoId");
  const l = await prisma.locacao.findUnique({ where: { id }, include: includeCompleto });
  if (!l) falha("Locação não encontrada", 404);
  if (userRole !== "ADMIN" && l.cliente?.usuarioId !== usuarioId) falha("Acesso negado a esta locação", 403);
  return l;
}

async function atualizarEstadoVeiculo(tx, veiculoId, locacaoId) {
  const outraEmAndamento = await tx.locacao.findFirst({
    where: { veiculoId, id: { not: locacaoId }, status: { in: ["retirada", "em_andamento"] } },
    select: { id: true },
  });
  if (outraEmAndamento) {
    await tx.veiculo.updateMany({ where: { id: veiculoId }, data: { status: "alugado" } });
    return;
  }
  const outraReserva = await tx.locacao.findFirst({
    where: { veiculoId, id: { not: locacaoId }, status: "reservada", dataPrevistaDevolucao: { gt: new Date() } },
    select: { id: true },
  });
  await tx.veiculo.updateMany({ where: { id: veiculoId, status: { in: ["alugado", "reservado"] } }, data: { status: outraReserva ? "reservado" : "disponivel" } });
}

async function listarChecklist() {
  return prisma.checklistItem.findMany({
    where: { configId: 1, ativo: true },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: { id: true, descricao: true, obrigatorio: true, ordem: true },
  });
}

async function validarVistoria(payload, campo) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) falha(`Vistoria ${campo} obrigatória`);
  const km = numeroInteiro(payload.km, `${campo}.km`);
  const nivelCombustivel = percentualCombustivel(payload.nivelCombustivel, `${campo}.nivelCombustivel`);
  const observacoes = payload.observacoes === undefined ? null : payload.observacoes;
  if (observacoes !== null && (typeof observacoes !== "string" || observacoes.length > 5000)) falha(`${campo}.observacoes inválidas`);
  const itensAtivos = await listarChecklist();
  const entradas = payload.itensChecklist === undefined ? [] : payload.itensChecklist;
  if (!Array.isArray(entradas)) falha(`${campo}.itensChecklist inválido`);
  const porId = new Map(itensAtivos.map((item) => [item.id, item]));
  const vistos = new Set();
  const itensChecklist = entradas.map((entrada) => {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) falha(`${campo}.itensChecklist inválido`);
    if (Object.keys(entrada).some((chave) => !["itemId", "conforme", "observacoes"].includes(chave))) falha(`${campo}.itensChecklist contém campos inválidos`);
    const itemId = idValido(entrada.itemId, `${campo}.itemId`);
    const item = porId.get(itemId);
    if (!item || vistos.has(itemId)) falha(`${campo}.itensChecklist contém item inativo, inexistente ou duplicado`);
    if (typeof entrada.conforme !== "boolean") falha(`${campo}.itensChecklist.conforme deve ser verdadeiro ou falso`);
    const observacaoItem = entrada.observacoes === undefined ? null : entrada.observacoes;
    if (observacaoItem !== null && (typeof observacaoItem !== "string" || observacaoItem.length > 500)) falha(`${campo}.itensChecklist.observacoes inválidas`);
    vistos.add(itemId);
    return { itemId: item.id, descricao: item.descricao, obrigatorio: item.obrigatorio, conforme: entrada.conforme, observacoes: observacaoItem?.trim() || null };
  });
  if (itensAtivos.some((item) => item.obrigatorio && !vistos.has(item.id))) falha(`${campo}: responda todos os itens obrigatórios do checklist`);
  return { km, nivelCombustivel, observacoes: observacoes?.trim() || null, itensChecklist };
}

async function registrarVistoria(tx, { locacao, tipo, dados }) {
  const vistoria = await tx.vistoria.create({
    data: {
      veiculoId: locacao.veiculoId,
      locacaoId: locacao.id,
      data: new Date(),
      tipo,
      km: dados.km,
      nivelCombustivel: dados.nivelCombustivel,
      observacoes: dados.observacoes,
      itensChecklist: dados.itensChecklist,
    },
  });
  return vistoria;
}

async function calcularCobrancasDevolucao(tx, locacao, dataDevolucao, vistoria) {
  const config = await obterConfiguracao(tx);
  const precos = await obterConfiguracaoPreco(tx);
  const diarias = calculo.calcularQuantidadeDiarias(locacao.dataInicio, dataDevolucao).qtdDiarias;
  const franquia = config.kmLivre || config.kmFranquiaDiaria === null ? null : Number(config.kmFranquiaDiaria) * diarias;
  const kmRodados = locacao.kmSaida === null ? null : vistoria.km - locacao.kmSaida;
  if (kmRodados !== null && kmRodados < 0) falha("Hodômetro de entrada não pode ser inferior ao de saída");
  const kmExcedente = franquia === null || kmRodados === null ? null : Math.max(0, kmRodados - franquia);
  const extras = [];
  if (kmExcedente > 0) {
    const valor = centavos(precos.valorKmExcedente).times(kmExcedente);
    if (valor.gt(0)) extras.push({ tipo: "km_excedente", descricao: `Excedente de ${kmExcedente} km`, valor });
  }
  const minutosAtraso = Math.max(0, Math.ceil((dataDevolucao.getTime() - locacao.dataPrevistaDevolucao.getTime()) / 60000) - Number(precos.atrasoToleranciaMinutos || config.toleranciaAtrasoMinutos || 0));
  if (minutosAtraso > 0) {
    const horasAtraso = Math.ceil(minutosAtraso / 60);
    const limite = Number(precos.atrasoLimiteHorasViraDiaria || 0);
    const valorDiaria = locacao.preco?.valorDiariaAplicada || 0;
    const valor = limite > 0 && horasAtraso >= limite
      ? centavos(valorDiaria).times(Math.ceil(horasAtraso / 24))
      : centavos(valorDiaria).times(precos.atrasoValorHoraPercentual || 0).div(100).times(horasAtraso);
    if (valor.gt(0)) extras.push({ tipo: "atraso", descricao: `Atraso de ${horasAtraso} hora(s)`, valor: valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) });
  }
  const nivelSaida = locacao.combustivelSaida;
  if (nivelSaida !== null && vistoria.nivelCombustivel < nivelSaida && config.politicaCombustivel === "cobrar_reposicao") {
    const valor = centavos(precos.taxaReposicaoCombustivel);
    if (valor.gt(0)) extras.push({ tipo: "combustivel", descricao: "Reposição de combustível", valor });
  }
  return { diarias, franquia, kmExcedente, extras };
}

async function transicionar(usuarioId, userRole, idEntrada, acao, body = {}) {
  const [de, para] = TRANSICOES[acao] || [];
  if (!de) falha("Transição inválida");
  const l = await buscar(usuarioId, userRole, idEntrada);
  if (l.status !== de) falha(`Transição não permitida: locação ${l.status}`, 409);
  if (!body || typeof body !== "object" || Array.isArray(body)) falha("Corpo inválido");
  const permitidos = acao === "cancelar" ? ["motivoCancelamento"] : acao === "retirar" || acao === "devolver" ? ["vistoria"] : [];
  const extras = Object.keys(body).filter((campo) => !permitidos.includes(campo));
  if (extras.length) falha(`Campos não permitidos: ${extras.join(", ")}`);
  const config = await obterConfiguracao();
  let vistoriaDados = null;
  if (acao === "retirar" && config.exigeVistoriaSaida) vistoriaDados = await validarVistoria(body.vistoria, "saida");
  if (acao === "devolver" && config.exigeVistoriaEntrada) vistoriaDados = await validarVistoria(body.vistoria, "entrada");
  if (acao === "cancelar" && body.motivoCancelamento !== undefined && (typeof body.motivoCancelamento !== "string" || body.motivoCancelamento.trim().length > 255)) falha("motivoCancelamento inválido");
  return prisma.$transaction(async (tx) => {
    const atual = await tx.locacao.findUnique({ where: { id: l.id }, include: { preco: true } });
    if (!atual || atual.status !== de) falha("Estado da locação alterado por outra operação", 409);
    const data = { status: para };
    let multaCancelamentoCalculada = null;
    if (acao === "retirar") {
      data.retiradaReal = new Date();
      if (vistoriaDados) {
        if (atual.kmSaida !== null && vistoriaDados.km < atual.kmSaida) falha("Hodômetro inválido");
        const veiculoKm = await tx.veiculo.findUnique({ where: { id: atual.veiculoId }, select: { kmAtual: true } });
        if (!veiculoKm || (veiculoKm.kmAtual !== null && vistoriaDados.km < veiculoKm.kmAtual)) falha("Hodômetro da saída não pode ser inferior ao hodômetro atual do veículo");
        const vistoria = await registrarVistoria(tx, { locacao: atual, tipo: "saida", dados: vistoriaDados });
        data.vistoriaSaidaId = vistoria.id;
        data.kmSaida = vistoriaDados.km;
        data.combustivelSaida = vistoriaDados.nivelCombustivel;
        await tx.veiculo.update({ where: { id: atual.veiculoId }, data: { kmAtual: vistoriaDados.km, nivelCombustivel: vistoriaDados.nivelCombustivel } });
      }
    }
    if (acao === "devolver") {
      const efetiva = new Date();
      data.dataDevolucaoEfetiva = efetiva;
      if (vistoriaDados) {
        const vistoria = await registrarVistoria(tx, { locacao: atual, tipo: "entrada", dados: vistoriaDados });
        data.vistoriaEntradaId = vistoria.id;
        data.kmEntrada = vistoriaDados.km;
        data.combustivelEntrada = vistoriaDados.nivelCombustivel;
        await tx.veiculo.update({ where: { id: atual.veiculoId }, data: { kmAtual: vistoriaDados.km, nivelCombustivel: vistoriaDados.nivelCombustivel } });
      }
      const cobrancas = await calcularCobrancasDevolucao(tx, atual, efetiva, vistoriaDados || { km: atual.kmEntrada, nivelCombustivel: atual.combustivelEntrada });
      data.qtdDiariasCobradas = cobrancas.diarias;
      data.kmFranquiaTotal = cobrancas.franquia;
      data.kmExcedente = cobrancas.kmExcedente;
      for (const extra of cobrancas.extras) {
        await tx.locacaoCobrancaExtra.create({ data: { locacaoId: atual.id, ...extra } });
        await tx.locacaoPagamento.create({ data: { locacaoId: atual.id, tipo: "saldo", valor: extra.valor, status: "pendente" } });
      }
    }
    if (acao === "cancelar") {
      data.canceladaEm = new Date();
      data.motivoCancelamento = body.motivoCancelamento?.trim() || "Cancelamento solicitado";
      const prazo = (atual.dataInicio.getTime() - Date.now()) / 3600000;
      const valorPercentual = prazo <= config.cancelamentoPrazoHoras ? Number(config.cancelamentoMultaPercentual) : 0;
      multaCancelamentoCalculada = centavos(atual.valorTotal).times(valorPercentual).div(100).toNumber();
      data.multaCancelamento = multaCancelamentoCalculada;
      if (multaCancelamentoCalculada > 0) {
        await tx.locacaoPagamento.create({ data: { locacaoId: atual.id, tipo: "saldo", valor: multaCancelamentoCalculada, status: "pendente" } });
      }
    }
    const updated = await tx.locacao.updateMany({ where: { id: atual.id, status: de }, data });
    if (!updated.count) falha("Estado da locação alterado por outra operação", 409);
    if (acao === "retirar") {
      const veiculoAtualizado = await tx.veiculo.updateMany({ where: { id: atual.veiculoId, status: "reservado" }, data: { status: "alugado" } });
      if (!veiculoAtualizado.count) falha("Veículo não está reservado para retirada", 409);
    }
    if (["devolver", "cancelar"].includes(acao)) await atualizarEstadoVeiculo(tx, atual.veiculoId, atual.id);
    await tx.locacaoStatusHistorico.create({ data: { locacaoId: atual.id, statusAnterior: de, statusNovo: para, usuarioId } });
    if (acao === "finalizar") {
      const extrasTotal = await tx.locacaoCobrancaExtra.aggregate({ where: { locacaoId: atual.id }, _sum: { valor: true } });
      const valorFinal = centavos(atual.valorTotal).plus(extrasTotal._sum.valor || 0);
      await tx.locacao.update({ where: { id: atual.id }, data: { valorFinalCobrado: valorFinal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) } });
    }
    const resultado = await tx.locacao.findUnique({ where: { id: atual.id }, include: includeCompleto });
    return acao === "cancelar" ? { ...resultado, multaCancelamentoCalculada } : resultado;
  }, { isolationLevel: "Serializable" });
}

async function listarDoUsuario(usuarioId, userRole) {
  return listar(usuarioId, userRole);
}

async function registrarCobrancaExtra(userRole, idEntrada, body) {
  if (userRole !== "ADMIN") falha("Acesso restrito a administradores", 403);
  const locacaoId = idValido(idEntrada, "locacaoId");
  if (!body || typeof body !== "object" || Array.isArray(body)) falha("Corpo inválido");
  const camposPermitidos = new Set(["tipo", "descricao", "valor"]);
  if (Object.keys(body).some((campo) => !camposPermitidos.has(campo))) falha("Campos inválidos na cobrança extra");
  const tipos = ["km_excedente", "combustivel", "limpeza", "atraso", "avaria", "multa_transito", "outros"];
  if (!tipos.includes(body.tipo)) falha("Tipo de cobrança inválido");
  if (typeof body.descricao !== "string" || !body.descricao.trim() || body.descricao.trim().length > 120) falha("Descrição da cobrança inválida");
  if ((typeof body.valor !== "number" && typeof body.valor !== "string") || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(body.valor))) falha("Valor da cobrança deve ser positivo e ter até duas casas decimais");
  const valor = new Decimal(body.valor);
  if (!valor.gt(0) || valor.gt("99999999.99")) falha("Valor da cobrança fora do limite permitido");

  return prisma.$transaction(async (tx) => {
    const atual = await tx.locacao.findUnique({ where: { id: locacaoId }, select: { id: true, status: true } });
    if (!atual) falha("Locação não encontrada", 404);
    if (atual.status !== "devolvida") falha("Cobranças extras manuais só podem ser registradas antes da finalização", 409);
    await tx.locacaoCobrancaExtra.create({
      data: { locacaoId, tipo: body.tipo, descricao: body.descricao.trim(), valor: valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) },
    });
    await tx.locacaoPagamento.create({
      data: { locacaoId, tipo: "saldo", valor: valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP), status: "pendente" },
    });
    return tx.locacao.findUnique({ where: { id: locacaoId }, include: includeCompleto });
  }, { isolationLevel: "Serializable" });
}

async function registrarAssinaturaContrato(userRole, idEntrada) {
  if (userRole !== "ADMIN") falha("Acesso restrito a administradores", 403);
  const id = idValido(idEntrada, "locacaoId");
  return prisma.$transaction(async (tx) => {
    const atual = await tx.locacao.findUnique({ where: { id }, select: { id: true, contratoTexto: true, contratoAssinado: true } });
    if (!atual) falha("Locação não encontrada", 404);
    if (!atual.contratoTexto) falha("A locação não possui snapshot de contrato", 409);
    if (atual.contratoAssinado) return tx.locacao.findUnique({ where: { id }, include: includeCompleto });
    const atualizado = await tx.locacao.updateMany({
      where: { id, contratoAssinado: false },
      data: { contratoAssinado: true, contratoAssinadoEm: new Date() },
    });
    if (!atualizado.count) falha("Estado do contrato alterado por outra operação", 409);
    return tx.locacao.findUnique({ where: { id }, include: includeCompleto });
  }, { isolationLevel: "Serializable" });
}

async function buscarDoUsuario(usuarioId, id) {
  return buscar(usuarioId, "USER", id);
}

async function finalizar(usuarioId, id) {
  return transicionar(usuarioId, "USER", id, "finalizar");
}

module.exports = {
  criar,
  listar,
  listarChecklist,
  listarDoUsuario,
  buscar,
  buscarDoUsuario,
  finalizar,
  transicionar,
  registrarCobrancaExtra,
  registrarAssinaturaContrato,
  reservarVeiculo,
  calcularValorTotal,
  transicoes: TRANSICOES,
  includeCompleto,
};
