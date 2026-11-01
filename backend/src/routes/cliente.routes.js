const { Router } = require('express');
const autenticar = require('../middlewares/auth.middleware');
const exigirAdmin = require('../middlewares/admin.middleware');
const controller = require('../controllers/cliente.controller');

const router = Router();
router.use(autenticar);
router.get('/me', controller.meuPerfil);
router.get('/', exigirAdmin, controller.listar);
router.get('/:id', exigirAdmin, controller.buscar);
router.post('/', exigirAdmin, controller.criar);
router.patch('/:id', exigirAdmin, controller.editar);
module.exports = router;
