const { Router } = require("express");
const c = require("../controllers/veiculo.controller");
const auth = require("../middlewares/auth.middleware");
const admin = require("../middlewares/admin.middleware");
const r = Router();
r.use(auth);
r.get("/metadados", c.metadados);
r.get("/", c.listar);
r.post("/", admin, c.cadastrar);
r.get("/:id", admin, c.detalhe);
r.patch("/:id", admin, c.editar);
r.get("/:id/historico", admin, c.historico);
r.post(
  "/:id/manutencoes",
  admin,
  (req, res, next) => {
    req.params.tipo = "manutencoes";
    next();
  },
  c.adicionar,
);
r.post(
  "/:id/sinistros",
  admin,
  (req, res, next) => {
    req.params.tipo = "sinistros";
    next();
  },
  c.adicionar,
);
r.post(
  "/:id/multas",
  admin,
  (req, res, next) => {
    req.params.tipo = "multas";
    next();
  },
  c.adicionar,
);
r.post(
  "/:id/vistorias",
  admin,
  (req, res, next) => {
    req.params.tipo = "vistorias";
    next();
  },
  c.adicionar,
);
module.exports = r;
