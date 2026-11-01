const service = require("../services/locacao.service");

async function criar(req, res) {
  const body = req.body || {};
  const dados = {
    usuarioId: req.userId,
    userRole: req.userRole,
    clienteId: body.clienteId,
    veiculoId: body.veiculoId,
    dataInicio: body.dataInicio,
    dataPrevistaDevolucao: body.dataPrevistaDevolucao,
    adicionais: body.adicionais,
    protecoes: body.protecoes,
    cupom: body.cupom,
    convenioId: body.convenioId,
    taxas: body.taxas,
    formaPagamento: body.formaPagamento,
    parcelas: body.parcelas,
    filialRetiradaId: body.filialRetiradaId,
    filialDevolucaoId: body.filialDevolucaoId,
    entregaDomicilio: body.entregaDomicilio,
    enderecoEntrega: body.enderecoEntrega,
    enderecoColeta: body.enderecoColeta,
    distanciaEntregaKm: body.distanciaEntregaKm,
    vooNumero: body.vooNumero,
    origem: body.origem,
    observacoes: body.observacoes,
    motoristas: body.motoristas,
  };
  res.status(201).json(await service.criar(dados));
}

async function listar(req, res) {
  res.json(await service.listar(req.userId, req.userRole));
}

async function listarChecklist(req, res) {
  res.json(await service.listarChecklist());
}

async function buscar(req, res) {
  res.json(await service.buscar(req.userId, req.userRole, req.params.id));
}

async function transicao(req, res) {
  res.json(await service.transicionar(req.userId, req.userRole, req.params.id, req.params.acao, req.body || {}));
}

async function registrarCobrancaExtra(req, res) {
  res.status(201).json(await service.registrarCobrancaExtra(req.userRole, req.params.id, req.body || {}));
}

async function marcarContratoAssinado(req, res) {
  res.json(await service.registrarAssinaturaContrato(req.userRole, req.params.id));
}

async function finalizar(req, res) {
  res.json(await service.transicionar(req.userId, req.userRole, req.params.id, "finalizar", {}));
}

module.exports = { criar, listar, listarChecklist, buscar, transicao, registrarCobrancaExtra, marcarContratoAssinado, finalizar };
