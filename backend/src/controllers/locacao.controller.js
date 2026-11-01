const service = require("../services/locacao.service");
async function criar(req, res) {
  const { veiculoId, dataInicio, dataPrevistaDevolucao } = req.body || {};
  res
    .status(201)
    .json(
      await service.criar({
        usuarioId: req.userId,
        veiculoId,
        dataInicio,
        dataPrevistaDevolucao,
      }),
    );
}
async function listar(req, res) {
  res.json(await service.listarDoUsuario(req.userId));
}
async function buscar(req, res) {
  res.json(await service.buscarDoUsuario(req.userId, req.params.id));
}
async function transicao(req, res) {
  res.json(
    await service.transicionar(req.userId, req.params.id, req.params.acao),
  );
}
async function finalizar(req, res) {
  res.json(await service.finalizar(req.userId, req.params.id));
}
module.exports = { criar, listar, buscar, transicao, finalizar };
