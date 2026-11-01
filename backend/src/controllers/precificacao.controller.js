const service = require("../services/precificacao.service");

async function cotar(req, res) {
  res.json(await service.cotar(req.body || {}, req.userId, req.userRole));
}
async function opcoes(req, res) {
  res.json(await service.obterOpcoes(req.params.veiculoId));
}
async function admin(req, res) {
  res.json(await service.obterAdmin());
}
async function configuracao(req, res) {
  res.json(await service.salvarConfiguracao(req.body || {}, req.userId));
}
async function custos(req, res) {
  res.json(await service.salvarCustos(req.params.veiculoId, req.body || {}, req.userId));
}
async function tarifas(req, res) {
  res.status(201).json(await service.salvarTarifa(null, req.body || {}, req.userId));
}
async function tarifa(req, res) {
  res.json(await service.salvarTarifa(req.params.id, req.body || {}, req.userId));
}
async function regras(req, res) {
  res.status(201).json(await service.salvarRegra(null, req.body || {}, req.userId));
}
async function regra(req, res) {
  res.json(await service.salvarRegra(req.params.id, req.body || {}, req.userId));
}
async function adicionais(req, res) {
  res.status(201).json(await service.salvarAdicional(null, req.body || {}, req.userId));
}
async function adicional(req, res) {
  res.json(await service.salvarAdicional(req.params.id, req.body || {}, req.userId));
}
async function protecoes(req, res) {
  res.status(201).json(await service.salvarProtecao(null, req.body || {}, req.userId));
}
async function protecao(req, res) {
  res.json(await service.salvarProtecao(req.params.id, req.body || {}, req.userId));
}
async function promocoes(req, res) {
  res.status(201).json(await service.salvarPromocao(null, req.body || {}, req.userId));
}
async function promocao(req, res) {
  res.json(await service.salvarPromocao(req.params.id, req.body || {}, req.userId));
}
async function niveis(req, res) {
  res.status(201).json(await service.salvarNivel(null, req.body || {}, req.userId));
}
async function nivel(req, res) {
  res.json(await service.salvarNivel(req.params.id, req.body || {}, req.userId));
}
async function piso(req, res) {
  res.json(await service.salvarPiso(req.params.categoriaId, req.body || {}, req.userId));
}
async function historico(req, res) {
  res.json(await service.listarHistorico({ origem: req.query.origem, registroId: req.query.registroId, limit: req.query.limit }));
}

module.exports = { cotar, opcoes, admin, configuracao, custos, tarifas, tarifa, regras, regra, adicionais, adicional, protecoes, protecao, promocoes, promocao, niveis, nivel, piso, historico };
