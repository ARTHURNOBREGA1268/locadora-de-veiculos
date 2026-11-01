const service = require('../services/cliente.service');

async function meuPerfil(req, res) {
  res.json(await service.obterMeuPerfil(req.userId));
}

async function listar(req, res) {
  res.json(await service.listar(req.query));
}

async function buscar(req, res) {
  res.json(await service.buscar(req.params.id));
}

async function criar(req, res) {
  res.status(201).json(await service.criar(req.body || {}));
}

async function editar(req, res) {
  res.json(await service.editar(req.params.id, req.body || {}));
}

module.exports = { meuPerfil, listar, buscar, criar, editar };
