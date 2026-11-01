const { Router } = require('express');
const controller = require('../controllers/locacao.controller');
const autenticar = require('../middlewares/auth.middleware');

const router = Router();

router.use(autenticar);
router.post('/', controller.criar);
router.get('/', controller.listar);
router.get('/:id', controller.buscar);
router.patch('/:id/finalizar', controller.finalizar);

module.exports = router;
