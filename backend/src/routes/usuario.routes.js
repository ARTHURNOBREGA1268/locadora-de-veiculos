const { Router } = require('express');
const autenticar = require('../middlewares/auth.middleware');
const exigirAdmin = require('../middlewares/admin.middleware');
const usuarioService = require('../services/usuario.service');

const router = Router();
router.get('/', autenticar, exigirAdmin, async (req, res) => res.status(200).json(await usuarioService.listar()));
router.post('/', autenticar, exigirAdmin, async (req, res) => res.status(201).json(await usuarioService.criar(req.body || {})));
router.patch('/:id', autenticar, exigirAdmin, async (req, res) => res.status(200).json(await usuarioService.editar(req.params.id, req.body || {}, req.userId)));
module.exports = router;
