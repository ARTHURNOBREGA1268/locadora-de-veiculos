const locacaoService = require('../services/locacao.service');

async function criar(req, res) {
  const { veiculoId, dataInicio, dataPrevistaDevolucao } = req.body || {};
  const locacao = await locacaoService.criar({
    usuarioId: req.userId,
    veiculoId,
    dataInicio,
    dataPrevistaDevolucao
  });
  res.status(201).json(locacao);
}

async function listar(req, res) {
  const locacoes = await locacaoService.listarDoUsuario(req.userId);
  res.status(200).json(locacoes);
}

async function buscar(req, res) {
  const locacao = await locacaoService.buscarDoUsuario(req.userId, req.params.id);
  res.status(200).json(locacao);
}

async function finalizar(req, res) {
  const locacao = await locacaoService.finalizar(req.userId, req.params.id);
  res.status(200).json(locacao);
}

module.exports = { criar, listar, buscar, finalizar };
