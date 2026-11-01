const { Router } = require("express");
const controller = require("../controllers/precificacao.controller");
const autenticar = require("../middlewares/auth.middleware");
const exigirAdmin = require("../middlewares/admin.middleware");

const router = Router();
router.post("/cotacao", autenticar, controller.cotar);
router.get("/opcoes/:veiculoId", autenticar, controller.opcoes);
router.use(autenticar, exigirAdmin);
router.get("/admin", controller.admin);
router.patch("/configuracao", controller.configuracao);
router.put("/custos/:veiculoId", controller.custos);
router.post("/tarifas", controller.tarifas);
router.patch("/tarifas/:id", controller.tarifa);
router.post("/regras", controller.regras);
router.patch("/regras/:id", controller.regra);
router.post("/adicionais", controller.adicionais);
router.patch("/adicionais/:id", controller.adicional);
router.post("/protecoes", controller.protecoes);
router.patch("/protecoes/:id", controller.protecao);
router.post("/promocoes", controller.promocoes);
router.patch("/promocoes/:id", controller.promocao);
router.post("/fidelidade", controller.niveis);
router.patch("/fidelidade/:id", controller.nivel);
router.patch("/pisos/:categoriaId", controller.piso);
router.get("/historico", controller.historico);

module.exports = router;
