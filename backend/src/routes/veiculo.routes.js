const { Router } = require('express');
const controller = require('../controllers/veiculo.controller');
const autenticar = require('../middlewares/auth.middleware');

const router = Router();

router.use(autenticar);
router.post('/', controller.cadastrar);
router.get('/', controller.listar);

module.exports = router;
