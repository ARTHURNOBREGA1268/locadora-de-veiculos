const service=require('../services/configuracao.service');
exports.obter=async(req,res)=>res.json(await service.obter());
exports.atualizar=async(req,res)=>res.json(await service.atualizar(req.body));
