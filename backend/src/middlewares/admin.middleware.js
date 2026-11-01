const AppError = require('../lib/AppError');

function exigirAdmin(req, res, next) {
  if (req.userRole !== 'ADMIN') throw new AppError('Acesso restrito a administradores', 403);
  next();
}

module.exports = exigirAdmin;
