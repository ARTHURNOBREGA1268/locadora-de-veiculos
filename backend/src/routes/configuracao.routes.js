const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const admin = require("../middlewares/admin.middleware");
const c = require("../controllers/configuracao.controller");
const r = Router();
r.use(auth, admin);
r.get("/locacao", c.obter);
r.put("/locacao", c.atualizar);
module.exports = r;
