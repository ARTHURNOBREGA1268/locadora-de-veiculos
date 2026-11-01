const authService = require('../services/auth.service');

async function registrar(req, res) {
  const usuario = await authService.registrar(req.body || {});
  res.status(201).json(usuario);
}

async function login(req, res) {
  const resultado = await authService.login(req.body || {});
  res.status(200).json(resultado);
}

async function perfil(req, res) {
  const usuario = await authService.perfil(req.userId);
  res.status(200).json(usuario);
}

module.exports = { registrar, login, perfil };
