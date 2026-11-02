const veiculoService = require("../services/veiculo.service");
const configuracaoService = require("../services/configuracao.service");

exports.listarVeiculos = async (_req, res) =>
  res.json(await veiculoService.listarCatalogo());

exports.obterRegras = async (_req, res) =>
  res.json(await configuracaoService.obterRegrasPublicas());
