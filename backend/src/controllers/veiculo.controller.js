const veiculoService = require('../services/veiculo.service');

async function cadastrar(req, res) {
  const veiculo = await veiculoService.cadastrar(req.body || {});
  res.status(201).json(veiculo);
}

async function listar(req, res) {
  const veiculos = await veiculoService.listar({ disponivel: req.query.disponivel });
  res.status(200).json(veiculos);
}

module.exports = { cadastrar, listar };
