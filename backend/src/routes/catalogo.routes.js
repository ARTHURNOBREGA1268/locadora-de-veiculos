const { Router } = require("express");
const controller = require("../controllers/catalogo.controller");

const router = Router();
router.get("/veiculos", controller.listarVeiculos);
router.get("/regras", controller.obterRegras);

module.exports = router;
