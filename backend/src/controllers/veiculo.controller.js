const service = require("../services/veiculo.service");
exports.cadastrar = async (req, res) =>
  res.status(201).json(await service.cadastrar(req.body || {}));
exports.editar = async (req, res) =>
  res.json(await service.editar(req.params.id, req.body || {}));
exports.listar = async (req, res) =>
  res.json(
    await service.listar({
      disponivel: req.query.disponivel,
      status: req.query.status,
    }),
  );
exports.metadados = async (req, res) => res.json(await service.metadados());
exports.detalhe = async (req, res) =>
  res.json(await service.detalhe(req.params.id));
exports.historico = async (req, res) =>
  res.json(await service.historico(req.params.id));
exports.locacoesVinculadas = async (req, res) =>
  res.json(await service.locacoesVinculadas(req.params.id));
exports.adicionar = async (req, res) =>
  res
    .status(201)
    .json(
      await service.adicionar(req.params.id, req.params.tipo, req.body || {}),
    );
